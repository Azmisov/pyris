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

// Plain URL detector used to auto-linkify URLs found inside TEXT tokens.
// Matches `scheme://…` and safe colon-only schemes (mailto/tel/sms/callto).
// Dangerous schemes (javascript:, data:, vbscript:) are intentionally excluded.
const PLAIN_URL_REGEX = /\b((?:[a-z][a-z0-9+.-]{2,}):\/\/[^\s<>"'{}|\\^`\[\]]+|(?:mailto|tel|sms|callto):[^\s<>"'{}|\\^`\[\]]+)/gi;

// Absolute POSIX file-path detector. Matches paths like `/home/user/foo.py`
// with optional `:line[:col]` suffix. Lookbehind requires a path-start boundary
// so we don't re-match the path portion of an already-captured URL — URL
// precedence is additionally enforced in collectLinks().
const PLAIN_PATH_REGEX = /(?<=^|[\s(\[{"'=|,])\/[a-zA-Z0-9._\-][a-zA-Z0-9._\-/]*(?::\d+(?::\d+)?)?/g;

interface LinkMatch {
  start: number;
  end: number;
  href: string;
  text: string;
}

// Scan text for URL and absolute-path matches. URL matches take precedence on
// overlap. Bare paths are emitted with a `file://` href so the link-confirm
// modal treats them like file URLs (it strips the prefix for display/copy).
function collectLinks(raw: string): LinkMatch[] {
  const matches: LinkMatch[] = [];

  PLAIN_URL_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PLAIN_URL_REGEX.exec(raw)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, href: m[1], text: m[1] });
  }

  PLAIN_PATH_REGEX.lastIndex = 0;
  while ((m = PLAIN_PATH_REGEX.exec(raw)) !== null) {
    let text = m[0];
    // Strip trailing dots (e.g. sentence terminator) without eating :line:col.
    const lineCol = text.match(/:\d+(?::\d+)?$/);
    if (lineCol) {
      const base = text.slice(0, lineCol.index).replace(/\.+$/, '');
      text = base + lineCol[0];
    } else {
      text = text.replace(/\.+$/, '');
    }
    if (text.length < 2) {continue;}
    const start = m.index;
    const end = start + text.length;
    if (matches.some(u => start < u.end && end > u.start)) {continue;}
    matches.push({ start, end, href: 'file://' + text, text });
  }

  matches.sort((a, b) => a.start - b.start);
  return matches;
}

// Convert ANSI escape sequences to HTML using CSS Modules + inline color styles.
// When `copyableClass` is provided, styled runs that aren't pure punctuation and
// don't contain a link get the class added — enabling click-to-copy on the row.
export function convertAnsiToHtml(
  text: string,
  classMap: Record<string, string>,
  linkClass: string,
  maxLength?: number,
  copyableClass?: string,
): AnsiConversionResult {
  if (!text) {
    return { html: '', truncatedChars: 0 };
  }

  try {
    const tokens = parse(text) as AnsiToken[];
    return tokensToHtml(tokens, classMap, linkClass, maxLength, copyableClass);
  } catch (error) {
    console.warn('Failed to parse ANSI text:', error);
    // Fallback: return text with basic escaping
    const escaped = escapeHtml(text);
    if (maxLength && maxLength > 0 && text.length > maxLength) {
      return {
        html: escaped.substring(0, maxLength) + '…',
        truncatedChars: text.length - maxLength,
      };
    }
    return { html: escaped, truncatedChars: 0 };
  }
}

// True if any SGR in the tokens produces a non-reset style.
// Used to gate copyable-class emission: only lines that actually contain
// formatting are treated as structured data that can be atomically copied.
function hasStylingTokens(tokens: AnsiToken[]): boolean {
  for (const t of tokens) {
    if (t.type !== 'CSI' || t.command !== 'm') {continue;}
    for (const p of t.params || []) {
      const code = parseInt(p, 10);
      if (!isNaN(code) && code !== 0) {return true;}
    }
  }
  return false;
}

const NON_PUNCT_RE = /[^\s\p{P}\p{S}]/u;

// Create an <a> element for a plain URL/path found inside text (not OSC-8).
function createPlainLinkHtml(href: string, text: string, linkClass: string): string {
  const escapedHref = escapeHtmlAttr(href);
  const escapedText = escapeHtml(text);
  return `<a href="${escapedHref}" title="${escapedHref}" class="${linkClass}" target="_blank" rel="noopener noreferrer" data-url="${escapedHref}">${escapedText}</a>`;
}

// Convert tokens to HTML with CSS Module classes, inline color styles, OSC-8
// hyperlinks, plain-URL linkification, and optional copyable-class marking.
// Supports early termination when maxLength is reached.
//
// Emission model: text accumulates into `pendingRaw` under the current styling
// context. On every context change (SGR, OSC-8 boundary, end-of-stream), we
// flush the buffer, splitting on plain URLs and wrapping the run in a single
// styled <span> so nested <a>s inherit ANSI color. The copyable class is
// applied to a run iff (a) the overall row has styling, (b) we're not inside
// an OSC-8 link, (c) the run has no plain URL, and (d) the text contains at
// least one non-punctuation character.
function tokensToHtml(
  tokens: AnsiToken[],
  classMap: Record<string, string>,
  linkClass: string,
  maxLength?: number,
  copyableClass?: string,
): AnsiConversionResult {
  let html = '';
  let currentStyles: string[] = [];
  let currentInlineStyles: Record<string, string> = {};
  let charCount = 0;
  let totalTextLength = 0;
  let truncated = false;

  // OSC-8 hyperlink state
  let linkUrl: string | null = null;
  let linkParams: Record<string, string> = {};
  let linkContentHtml = '';

  let pendingRaw = '';
  const rowHasStyling = !!copyableClass && hasStylingTokens(tokens);

  const emit = (chunk: string) => {
    if (!chunk) {return;}
    if (linkUrl) {linkContentHtml += chunk;}
    else {html += chunk;}
  };

  const flushPending = () => {
    if (!pendingRaw) {return;}
    const raw = pendingRaw;
    pendingRaw = '';

    // Build the run's inner HTML: plain text, with <a> inlined for plain URLs
    // and absolute file paths (skipped when we're inside an OSC-8 link — that
    // content is already a link — and on the truncated final flush, where the
    // URL/path may be cut off).
    let inner = '';
    if (linkUrl || truncated) {
      inner = escapeHtml(raw);
    } else {
      let lastIdx = 0;
      for (const link of collectLinks(raw)) {
        if (link.start > lastIdx) {
          inner += escapeHtml(raw.substring(lastIdx, link.start));
        }
        inner += createPlainLinkHtml(link.href, link.text, linkClass);
        lastIdx = link.end;
      }
      if (lastIdx < raw.length) {
        inner += escapeHtml(raw.substring(lastIdx));
      }
    }

    const styleClasses = currentStyles.map(s => classMap[s]);
    const hasStyleClasses = styleClasses.length > 0;
    const hasInline = Object.keys(currentInlineStyles).length > 0;
    // Allow copyable on spans that contain a plain <a> too: the click handler
    // bails on target.closest('a'), so link clicks fall through to the modal,
    // and clicks on surrounding text copy the full run (URL text included).
    const wantCopyable = rowHasStyling && !linkUrl && NON_PUNCT_RE.test(raw);

    if (!hasStyleClasses && !hasInline && !wantCopyable) {
      emit(inner);
      return;
    }
    const classes = [...styleClasses];
    if (wantCopyable) {classes.push(copyableClass!);}
    const classAttr = classes.length > 0 ? ` class="${classes.join(' ')}"` : '';
    const styleAttr = hasInline
      ? ` style="${Object.entries(currentInlineStyles).map(([k, v]) => `${k}:${v}`).join(';')}"`
      : '';
    emit(`<span${classAttr}${styleAttr}>${inner}</span>`);
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
    if (maxLength && maxLength > 0 && charCount >= maxLength) {
      truncated = true;
      break;
    }

    switch (token.type) {
      case 'TEXT': {
        let textToAdd = token.raw;
        if (maxLength && maxLength > 0 && charCount + textToAdd.length > maxLength) {
          textToAdd = textToAdd.substring(0, maxLength - charCount);
          truncated = true;
        }
        charCount += textToAdd.length;
        pendingRaw += textToAdd;
        break;
      }

      case 'CSI': {
        if (token.command === 'm') {
          flushPending();
          const result = processSgrCommand(token.params || [], currentStyles, currentInlineStyles);
          currentStyles = result.classes;
          currentInlineStyles = result.inlineStyles;
        }
        break;
      }

      case 'OSC':
        if (token.command === '8') {
          // OSC-8 hyperlink sequence. Flush buffered text first so it lands on
          // the correct side of the link boundary (before-open goes to outer
          // html; before-close goes inside the <a>).
          flushPending();
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
              const linkHtml = createHyperlink(linkUrl, linkContentHtml, linkParams, linkClass);
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

  flushPending();
  if (linkUrl && linkContentHtml) {
    html += createHyperlink(linkUrl, linkContentHtml, linkParams, linkClass);
  }

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

  if (!paramString) {return params;}

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
function createHyperlink(url: string, contentHtml: string, _params: Record<string, string>, linkClass: string): string {
  // Validate URL (user consent is required via modal in the UI)
  try {
    new URL(url);
  } catch {
    // Invalid URL - return content without link
    return contentHtml;
  }

  // Escape URL for HTML attribute
  const escapedUrl = escapeHtmlAttr(url);

  return `<a href="${escapedUrl}" title="${escapedUrl}" class="${linkClass}" target="_blank" rel="noopener noreferrer" data-url="${escapedUrl}">${contentHtml}</a>`;
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

      // Foreground colors (30-37, 90-97) — inline styles with CSS variables
      case 30: case 31: case 32: case 33: case 34: case 35: case 36: case 37:
        inlineStyles['color'] = `var(--ansi-color-${code - 30})`;
        break;

      case 90: case 91: case 92: case 93: case 94: case 95: case 96: case 97:
        inlineStyles['color'] = `var(--ansi-color-${code - 90 + 8})`;
        break;

      // Background colors (40-47, 100-107) — inline styles with CSS variables
      case 40: case 41: case 42: case 43: case 44: case 45: case 46: case 47:
        inlineStyles['background-color'] = `var(--ansi-color-${code - 40})`;
        break;

      case 100: case 101: case 102: case 103: case 104: case 105: case 106: case 107:
        inlineStyles['background-color'] = `var(--ansi-color-${code - 100 + 8})`;
        break;

      case 39: // Default foreground
        delete inlineStyles['color'];
        break;

      case 49: // Default background
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
          inlineStyles['color'] = `var(--ansi-color-${colorIndex})`;
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
          inlineStyles['color'] = `rgb(${r},${g},${b})`;
          i += skipCount;
        }
        break;

      case 48: // Extended background color
        // Need to look ahead in params for 256-color or truecolor
        if (i + 2 < params.length && params[i + 1] === '5') {
          // 256-color: ESC[48;5;{n}m
          const colorIndex = parseInt(params[i + 2], 10);
          inlineStyles['background-color'] = `var(--ansi-color-${colorIndex})`;
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
          inlineStyles['background-color'] = `rgb(${r},${g},${b})`;
          i += skipCount;
        }
        break;

      case 58: // Set underline color
        // Need to look ahead in params for 256-color or truecolor
        if (i + 2 < params.length && params[i + 1] === '5') {
          // 256-color: ESC[58;5;{n}m
          const colorIndex = parseInt(params[i + 2], 10);
          inlineStyles['text-decoration-color'] = `var(--ansi-color-${colorIndex})`;
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
          inlineStyles['text-decoration-color'] = `rgb(${r},${g},${b})`;
          i += skipCount;
        }
        break;

      case 59: // Default underline color
        delete inlineStyles['text-decoration-color'];
        break;
    }
  }

  return { classes: styles, inlineStyles };
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

