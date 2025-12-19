import { parse } from '@ansi-tools/parser';

interface AnsiToken {
  type: string;
  raw: string;
  pos?: number;
  command?: string;
  params?: string[];
}

/** Result of ANSI to HTML conversion with truncation info */
export interface AnsiConversionResult {
  html: string;
  /** Number of characters truncated (0 if not truncated) */
  truncatedChars: number;
}

// Convert ANSI escape sequences to HTML using CSS variables
export function convertAnsiToHtml(text: string, maxLength?: number): AnsiConversionResult {
  if (!text) {
    return { html: '', truncatedChars: 0 };
  }

  try {
    const tokens = parse(text) as AnsiToken[];
    return tokensToHtml(tokens, maxLength);
  } catch (error) {
    console.warn('Failed to parse ANSI text:', error);
    // Fallback: return text with basic escaping
    const escaped = escapeHtml(text);
    if (maxLength && maxLength > 0 && text.length > maxLength) {
      return {
        html: escaped.substring(0, maxLength) + '…',
        truncatedChars: text.length - maxLength
      };
    }
    return { html: escaped, truncatedChars: 0 };
  }
}

// Convert tokens to HTML with CSS classes, inline styles, and OSC-8 hyperlinks
// Supports early termination when maxLength is reached
function tokensToHtml(tokens: AnsiToken[], maxLength?: number): AnsiConversionResult {
  let html = '';
  let currentStyles: string[] = [];
  let currentInlineStyles: Record<string, string> = {};
  let charCount = 0; // Track visible character count
  let totalTextLength = 0; // Track total text length for truncation calculation
  let truncated = false;

  // OSC-8 hyperlink state
  let linkUrl: string | null = null;
  let linkParams: Record<string, string> = {};
  let linkContentHtml = '';

  // Helper to close current styling span
  const closeCurrentSpan = (): string => {
    if (currentStyles.length > 0 || Object.keys(currentInlineStyles).length > 0) {
      return '</span>';
    }
    return '';
  };

  // First pass: calculate total text length for truncation info
  if (maxLength && maxLength > 0) {
    for (const token of tokens) {
      if (token.type === 'TEXT') {
        totalTextLength += token.raw.length;
      }
    }
  }

  for (const token of tokens) {
    // Check if we've hit the limit
    if (maxLength && maxLength > 0 && charCount >= maxLength) {
      truncated = true;
      break;
    }

    switch (token.type) {
      case 'TEXT':
        let textToAdd = token.raw;

        // Check if this text would exceed the limit
        if (maxLength && maxLength > 0 && charCount + textToAdd.length > maxLength) {
          // Truncate the text to fit
          const remaining = maxLength - charCount;
          textToAdd = textToAdd.substring(0, remaining);
          truncated = true;
        }

        const escapedText = escapeHtml(textToAdd);
        charCount += textToAdd.length;

        if (linkUrl) {
          // Inside a link - collect content
          linkContentHtml += escapedText;
        } else {
          // Normal text
          html += escapedText;
        }

        // Stop processing if we've truncated
        if (truncated) {
          break;
        }
        break;

      case 'CSI':
        if (token.command === 'm') {
          // SGR (Select Graphic Rendition) command
          const result = processSgrCommand(token.params || [], currentStyles, currentInlineStyles);
          const newStyles = result.classes;
          const newInlineStyles = result.inlineStyles;

          // Generate style change HTML
          let styleChangeHtml = '';

          // Close current spans if styles changed
          if (currentStyles.length > 0 || Object.keys(currentInlineStyles).length > 0) {
            styleChangeHtml += '</span>';
          }

          // Open new spans for new styles
          if (newStyles.length > 0 || Object.keys(newInlineStyles).length > 0) {
            const classAttr = newStyles.length > 0 ? ` class="${newStyles.join(' ')}"` : '';
            const styleAttr = Object.keys(newInlineStyles).length > 0
              ? ` style="${Object.entries(newInlineStyles).map(([k, v]) => `${k}:${v}`).join(';')}"`
              : '';
            styleChangeHtml += `<span${classAttr}${styleAttr}>`;
          }

          if (linkUrl) {
            // Inside a link - collect styling
            linkContentHtml += styleChangeHtml;
          } else {
            // Normal context
            html += styleChangeHtml;
          }

          currentStyles = newStyles;
          currentInlineStyles = newInlineStyles;
        }
        break;

      case 'OSC':
        if (token.command === '8') {
          // OSC-8 hyperlink sequence
          const params = token.params || [];
          const paramsString = params[0] || '';
          const url = params[1] || '';

          if (url) {
            // Open link
            linkUrl = url;
            linkParams = parseOsc8Params(paramsString);
            linkContentHtml = '';
          } else {
            // Close link
            if (linkUrl) {
              // Wrap collected content in <a> tag
              const linkHtml = createHyperlink(linkUrl, linkContentHtml, linkParams);
              html += linkHtml;

              linkUrl = null;
              linkParams = {};
              linkContentHtml = '';
            }
          }
        }
        break;

      // Ignore other sequences (cursor movement, etc.)
      default:
        break;
    }

    // Break out of loop if truncated
    if (truncated) {
      break;
    }
  }

  // Close any remaining open link (with partial content if truncated)
  if (linkUrl && linkContentHtml) {
    const linkHtml = createHyperlink(linkUrl, linkContentHtml, linkParams);
    html += linkHtml;
  }

  // Close any remaining open spans
  html += closeCurrentSpan();

  // Add ellipsis if truncated
  if (truncated) {
    html += '…';
  }

  return {
    html,
    truncatedChars: truncated ? totalTextLength - charCount : 0
  };
}

// Parse OSC-8 parameters (key=value pairs separated by :)
function parseOsc8Params(paramString: string): Record<string, string> {
  const params: Record<string, string> = {};

  if (!paramString) return params;

  const pairs = paramString.split(':');
  for (const pair of pairs) {
    const [key, value] = pair.split('=', 2);
    if (key && value !== undefined) {
      params[key.trim()] = value.trim();
    }
  }

  return params;
}

// Create HTML hyperlink from OSC-8 data
function createHyperlink(url: string, contentHtml: string, _params: Record<string, string>): string {
  // Validate URL (user consent is required via modal in the UI)
  try {
    new URL(url);
  } catch {
    // Invalid URL - return content without link
    return contentHtml;
  }

  // Escape URL for HTML attribute
  const escapedUrl = escapeHtmlAttr(url);

  return `<a href="${escapedUrl}" title="${escapedUrl}" target="_blank" rel="noopener noreferrer">${contentHtml}</a>`;
}

// Escape text for HTML attributes (more strict than content escaping)
function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Process SGR (Select Graphic Rendition) commands
function processSgrCommand(
  params: string[],
  currentStyles: string[],
  currentInlineStyles: Record<string, string>
): { classes: string[]; inlineStyles: Record<string, string> } {
  const styles = [...currentStyles];
  const inlineStyles = { ...currentInlineStyles };

  // Default to reset if no params
  if (params.length === 0) {
    return { classes: [], inlineStyles: {} };
  }


  for (let i = 0; i < params.length; i++) {
    const paramStr = params[i];
    const code = parseInt(paramStr, 10);

    switch (code) {
      case 0: // Reset
        return { classes: [], inlineStyles: {} };

      case 1: // Bold
        if (!styles.includes('ansi-bold')) {
          styles.push('ansi-bold');
        }
        break;

      case 2: // Faint/dim
        if (!styles.includes('ansi-faint')) {
          styles.push('ansi-faint');
        }
        break;

      case 3: // Italic
        if (!styles.includes('ansi-italic')) {
          styles.push('ansi-italic');
        }
        break;

      case 4: // Underline
        if (!styles.includes('ansi-underline')) {
          styles.push('ansi-underline');
        }
        break;

      case 5: // Slow blink
        if (!styles.includes('ansi-blink-slow')) {
          styles.push('ansi-blink-slow');
        }
        break;

      case 6: // Rapid blink
        if (!styles.includes('ansi-blink-rapid')) {
          styles.push('ansi-blink-rapid');
        }
        break;

      case 8: // Conceal/hide
        if (!styles.includes('ansi-conceal')) {
          styles.push('ansi-conceal');
        }
        break;

      case 9: // Crossed-out/strike
        if (!styles.includes('ansi-strike')) {
          styles.push('ansi-strike');
        }
        break;

      case 21: // Doubly underlined
        if (!styles.includes('ansi-double-underline')) {
          styles.push('ansi-double-underline');
        }
        break;

      case 22: // Normal intensity (not bold, not faint)
        removeFromArray(styles, 'ansi-bold');
        removeFromArray(styles, 'ansi-faint');
        break;

      case 23: // Not italic
        removeFromArray(styles, 'ansi-italic');
        break;

      case 24: // Not underlined
        removeFromArray(styles, 'ansi-underline');
        removeFromArray(styles, 'ansi-double-underline');
        break;

      case 25: // Not blinking
        removeFromArray(styles, 'ansi-blink-slow');
        removeFromArray(styles, 'ansi-blink-rapid');
        break;

      case 28: // Reveal (not concealed)
        removeFromArray(styles, 'ansi-conceal');
        break;

      case 29: // Not crossed out
        removeFromArray(styles, 'ansi-strike');
        break;

      // Foreground colors (30-37, 90-97)
      case 30: case 31: case 32: case 33: case 34: case 35: case 36: case 37:
        removeColorClasses(styles, 'ansi-fg-');
        delete inlineStyles['color'];
        styles.push(`ansi-fg-${code - 30}`);
        break;

      case 90: case 91: case 92: case 93: case 94: case 95: case 96: case 97:
        removeColorClasses(styles, 'ansi-fg-');
        delete inlineStyles['color'];
        styles.push(`ansi-fg-${code - 90 + 8}`);
        break;

      // Background colors (40-47, 100-107)
      case 40: case 41: case 42: case 43: case 44: case 45: case 46: case 47:
        removeColorClasses(styles, 'ansi-bg-');
        delete inlineStyles['background-color'];
        styles.push(`ansi-bg-${code - 40}`);
        break;

      case 100: case 101: case 102: case 103: case 104: case 105: case 106: case 107:
        removeColorClasses(styles, 'ansi-bg-');
        delete inlineStyles['background-color'];
        styles.push(`ansi-bg-${code - 100 + 8}`);
        break;

      case 39: // Default foreground
        removeColorClasses(styles, 'ansi-fg-');
        delete inlineStyles['color'];
        break;

      case 49: // Default background
        removeColorClasses(styles, 'ansi-bg-');
        delete inlineStyles['background-color'];
        break;

      case 51: // Framed
        if (!styles.includes('ansi-framed')) {
          styles.push('ansi-framed');
        }
        break;

      case 52: // Encircled
        if (!styles.includes('ansi-encircled')) {
          styles.push('ansi-encircled');
        }
        break;

      case 53: // Overlined
        if (!styles.includes('ansi-overline')) {
          styles.push('ansi-overline');
        }
        break;

      case 54: // Neither framed nor encircled
        removeFromArray(styles, 'ansi-framed');
        removeFromArray(styles, 'ansi-encircled');
        break;

      case 55: // Not overlined
        removeFromArray(styles, 'ansi-overline');
        break;

      case 73: // Superscript
        if (!styles.includes('ansi-superscript')) {
          styles.push('ansi-superscript');
        }
        break;

      case 74: // Subscript
        if (!styles.includes('ansi-subscript')) {
          styles.push('ansi-subscript');
        }
        break;

      case 75: // Neither superscript nor subscript
        removeFromArray(styles, 'ansi-superscript');
        removeFromArray(styles, 'ansi-subscript');
        break;

      case 38: // Extended foreground color
        // Need to look ahead in params for 256-color or truecolor
        if (i + 2 < params.length && params[i + 1] === '5') {
          // 256-color: ESC[38;5;{n}m
          const colorIndex = parseInt(params[i + 2], 10);
          removeColorClasses(styles, 'ansi-fg-');
          delete inlineStyles['color'];
          styles.push(`ansi-fg-${colorIndex}`);
          i += 2;
        } else if (i + 2 < params.length && params[i + 1] === '2') {
          // Truecolor: ESC[38;2;{r};{g};{b}m
          // Parser behavior varies: sometimes adds colorspace '0', sometimes doesn't
          let r, g, b, skipCount;
          if (params[i + 2] === '0' && i + 5 < params.length) {
            // Format: 38;2;0;r;g;b (with implicit colorspace)
            r = parseInt(params[i + 3], 10);
            g = parseInt(params[i + 4], 10);
            b = parseInt(params[i + 5], 10);
            skipCount = 5;
          } else if (i + 4 < params.length) {
            // Format: 38;2;r;g;b (without colorspace)
            r = parseInt(params[i + 2], 10);
            g = parseInt(params[i + 3], 10);
            b = parseInt(params[i + 4], 10);
            skipCount = 4;
          } else {
            break;
          }
          removeColorClasses(styles, 'ansi-fg-');
          inlineStyles['color'] = `rgb(${r},${g},${b})`;
          i += skipCount;
        }
        break;

      case 48: // Extended background color
        // Need to look ahead in params for 256-color or truecolor
        if (i + 2 < params.length && params[i + 1] === '5') {
          // 256-color: ESC[48;5;{n}m
          const colorIndex = parseInt(params[i + 2], 10);
          removeColorClasses(styles, 'ansi-bg-');
          delete inlineStyles['background-color'];
          styles.push(`ansi-bg-${colorIndex}`);
          i += 2;
        } else if (i + 2 < params.length && params[i + 1] === '2') {
          // Truecolor: ESC[48;2;{r};{g};{b}m
          // Parser behavior varies: sometimes adds colorspace '0', sometimes doesn't
          let r, g, b, skipCount;
          if (params[i + 2] === '0' && i + 5 < params.length) {
            // Format: 48;2;0;r;g;b (with implicit colorspace)
            r = parseInt(params[i + 3], 10);
            g = parseInt(params[i + 4], 10);
            b = parseInt(params[i + 5], 10);
            skipCount = 5;
          } else if (i + 4 < params.length) {
            // Format: 48;2;r;g;b (without colorspace)
            r = parseInt(params[i + 2], 10);
            g = parseInt(params[i + 3], 10);
            b = parseInt(params[i + 4], 10);
            skipCount = 4;
          } else {
            break;
          }
          removeColorClasses(styles, 'ansi-bg-');
          inlineStyles['background-color'] = `rgb(${r},${g},${b})`;
          i += skipCount;
        }
        break;

      case 58: // Set underline color
        // Need to look ahead in params for 256-color or truecolor
        if (i + 2 < params.length && params[i + 1] === '5') {
          // 256-color: ESC[58;5;{n}m
          const colorIndex = parseInt(params[i + 2], 10);
          removeColorClasses(styles, 'ansi-underline-color-');
          delete inlineStyles['text-decoration-color'];
          styles.push(`ansi-underline-color-${colorIndex}`);
          // Skip the next 2 params
          i += 2;
        } else if (i + 2 < params.length && params[i + 1] === '2') {
          // Truecolor: ESC[58;2;{r};{g};{b}m
          // Parser behavior varies: sometimes adds colorspace '0', sometimes doesn't
          let r, g, b, skipCount;
          if (params[i + 2] === '0' && i + 5 < params.length) {
            // Format: 58;2;0;r;g;b (with implicit colorspace)
            r = parseInt(params[i + 3], 10);
            g = parseInt(params[i + 4], 10);
            b = parseInt(params[i + 5], 10);
            skipCount = 5;
          } else if (i + 4 < params.length) {
            // Format: 58;2;r;g;b (without colorspace)
            r = parseInt(params[i + 2], 10);
            g = parseInt(params[i + 3], 10);
            b = parseInt(params[i + 4], 10);
            skipCount = 4;
          } else {
            break;
          }
          removeColorClasses(styles, 'ansi-underline-color-');
          inlineStyles['text-decoration-color'] = `rgb(${r},${g},${b})`;
          i += skipCount;
        }
        break;

      case 59: // Default underline color
        removeColorClasses(styles, 'ansi-underline-color-');
        delete inlineStyles['text-decoration-color'];
        break;
    }
  }

  return { classes: styles, inlineStyles };
}

// Remove all classes with a specific prefix
function removeColorClasses(styles: string[], prefix: string): void {
  for (let i = styles.length - 1; i >= 0; i--) {
    if (styles[i].startsWith(prefix)) {
      styles.splice(i, 1);
    }
  }
}

// Remove specific item from array
function removeFromArray(array: string[], item: string): void {
  const index = array.indexOf(item);
  if (index !== -1) {
    array.splice(index, 1);
  }
}

// Escape HTML characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strip ANSI escape sequences for plain text view
 *
 * Parses the input string and extracts only the text content,
 * removing all ANSI control sequences (colors, styling, cursor movement, etc.)
 *
 * @param {string} input - String potentially containing ANSI escape sequences
 * @returns {string} Plain text with all ANSI codes removed
 *
 * @example
 * ```ts
 * stripAnsiCodes('\x1b[31mRed text\x1b[0m') // Returns: 'Red text'
 * ```
 */
export function stripAnsiCodes(input: string): string {
  if (!input) {
    return '';
  }

  try {
    const tokens = parse(input) as AnsiToken[];
    let text = '';

    // Extract only TEXT tokens, ignoring all control sequences
    for (const token of tokens) {
      if (token.type === 'TEXT') {
        text += token.raw;
      }
    }

    return text;
  } catch (error) {
    console.warn('Failed to parse ANSI text for stripping:', error);
    // Fallback to regex-based stripping if parser fails
    return input.replace(
      // eslint-disable-next-line no-control-regex
      /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b\][^\x1b]*\x1b\\/g,
      ''
    );
  }
}

/**
 * Check if string contains ANSI escape sequences
 *
 * Parses the input string and returns true if it contains any non-text tokens
 * (i.e., any ANSI control sequences like colors, styling, cursor movement, etc.)
 *
 * @param {string} input - String to check for ANSI codes
 * @returns {boolean} True if ANSI codes are present, false otherwise
 *
 * @example
 * ```ts
 * hasAnsiCodes('\x1b[31mRed text\x1b[0m') // Returns: true
 * hasAnsiCodes('Plain text') // Returns: false
 * ```
 */
export function hasAnsiCodes(input: string): boolean {
  if (!input) {
    return false;
  }

  try {
    const tokens = parse(input) as AnsiToken[];

    // Return true on first non-TEXT token
    for (const token of tokens) {
      if (token.type !== 'TEXT') {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.warn('Failed to parse ANSI text for detection:', error);
    // Fallback to simple detection if parser fails
    return input.indexOf('\x1b') !== -1;
  }
}

