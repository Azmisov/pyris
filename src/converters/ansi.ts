import { parse } from '@ansi-tools/parser';

interface AnsiToken {
  type: string;
  raw: string;
  pos?: number;
  command?: string;
  params?: string[];
}

// Convert ANSI escape sequences to HTML using CSS variables
export function convertAnsiToHtml(text: string): string {
  if (!text) {
    return '';
  }

  try {
    const tokens = parse(text) as AnsiToken[];
    return tokensToHtml(tokens);
  } catch (error) {
    console.warn('Failed to parse ANSI text:', error);
    // Fallback: return text with basic escaping
    return escapeHtml(text);
  }
}

// Alias for backward compatibility
export const ansiToHtml = convertAnsiToHtml;

// Convert tokens to HTML with CSS classes and inline styles
function tokensToHtml(tokens: AnsiToken[]): string {
  let html = '';
  let currentStyles: string[] = [];
  let currentInlineStyles: Record<string, string> = {};

  for (const token of tokens) {
    switch (token.type) {
      case 'TEXT':
        html += escapeHtml(token.raw);
        break;

      case 'CSI':
        if (token.command === 'm') {
          // SGR (Select Graphic Rendition) command
          const result = processSgrCommand(token.params || [], currentStyles, currentInlineStyles);
          const newStyles = result.classes;
          const newInlineStyles = result.inlineStyles;

          // Close current spans if styles changed
          if (currentStyles.length > 0 || Object.keys(currentInlineStyles).length > 0) {
            html += '</span>';
          }

          // Open new spans for new styles
          if (newStyles.length > 0 || Object.keys(newInlineStyles).length > 0) {
            const classAttr = newStyles.length > 0 ? ` class="${newStyles.join(' ')}"` : '';
            const styleAttr = Object.keys(newInlineStyles).length > 0
              ? ` style="${Object.entries(newInlineStyles).map(([k, v]) => `${k}:${v}`).join(';')}"`
              : '';
            html += `<span${classAttr}${styleAttr}>`;
          }

          currentStyles = newStyles;
          currentInlineStyles = newInlineStyles;
        }
        break;

      // Ignore other ANSI sequences for now (cursor movement, etc.)
      default:
        break;
    }
  }

  // Close any remaining open spans
  if (currentStyles.length > 0 || Object.keys(currentInlineStyles).length > 0) {
    html += '</span>';
  }

  return html;
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

// Truncate long lines if needed
export function truncateLine(html: string, maxLength: number): string {
  if (maxLength <= 0) return html;

  // Simple truncation - for more sophisticated truncation that preserves
  // ANSI styling, we'd need to parse the HTML structure
  const plainText = stripAnsiCodes(html);
  if (plainText.length <= maxLength) {
    return html;
  }

  // Truncate and add ellipsis
  return html.substring(0, maxLength) + '...';
}