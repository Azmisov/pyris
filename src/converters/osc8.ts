import { Osc8Link } from '../types';

// OSC-8 sequence patterns
// Open: ESC ] 8 ; params ; url ST  (ST can be ESC \ or BEL)
// Close: ESC ] 8 ; ; ST
// eslint-disable-next-line no-control-regex
const OSC8_OPEN_REGEX = /\x1b\]8;([^;]*);([^\x07\x1b]*)([\x07]|\x1b\\)/g;
// eslint-disable-next-line no-control-regex
const OSC8_CLOSE_REGEX = /\x1b\]8;;([\x07]|\x1b\\)/g;

// Parse OSC-8 hyperlinks from raw text and return structured data
export function parseOsc8Links(rawText: string): Osc8Link[] {
  const links: Osc8Link[] = [];
  let currentLink: Partial<Osc8Link> | null = null;

  // Find all OSC-8 sequences in order
  const sequences: Array<{ type: 'open' | 'close'; match: RegExpMatchArray; index: number }> = [];

  // Find opens
  let match;
  OSC8_OPEN_REGEX.lastIndex = 0;
  while ((match = OSC8_OPEN_REGEX.exec(rawText)) !== null) {
    sequences.push({ type: 'open', match, index: match.index });
  }

  // Find closes
  OSC8_CLOSE_REGEX.lastIndex = 0;
  while ((match = OSC8_CLOSE_REGEX.exec(rawText)) !== null) {
    sequences.push({ type: 'close', match, index: match.index });
  }

  // Sort by position
  sequences.sort((a, b) => a.index - b.index);

  // Process sequences
  for (const seq of sequences) {
    if (seq.type === 'open') {
      const [fullMatch, params, url] = seq.match;

      // Close any existing link (OSC-8 doesn't nest)
      if (currentLink) {
        currentLink.end = seq.index;
        currentLink.text = rawText.substring(currentLink.start!, currentLink.end);
        if (isValidLink(currentLink as Osc8Link)) {
          links.push(currentLink as Osc8Link);
        }
      }

      // Start new link
      currentLink = {
        url: url.trim(),
        start: seq.index + fullMatch.length,
        params: parseOsc8Params(params),
      };
    } else if (seq.type === 'close') {
      // Close current link
      if (currentLink) {
        currentLink.end = seq.index;
        currentLink.text = rawText.substring(currentLink.start!, currentLink.end);
        if (isValidLink(currentLink as Osc8Link)) {
          links.push(currentLink as Osc8Link);
        }
        currentLink = null;
      }
    }
  }

  // Handle unclosed link at end of text
  if (currentLink) {
    currentLink.end = rawText.length;
    currentLink.text = rawText.substring(currentLink.start!, currentLink.end);
    if (isValidLink(currentLink as Osc8Link)) {
      links.push(currentLink as Osc8Link);
    }
  }

  return links;
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

// Validate link structure and URL
function isValidLink(link: Osc8Link): boolean {
  return !!(
    link.url &&
    link.text &&
    link.start !== undefined &&
    link.end !== undefined &&
    link.start < link.end &&
    link.text.trim().length > 0
  );
}

// Apply OSC-8 hyperlinks to ANSI-processed HTML
export function applyOsc8Links(htmlWithAnsi: string, rawText: string, allowedSchemes: string[]): string {
  const links = parseOsc8Links(rawText);

  if (links.length === 0) {
    return htmlWithAnsi;
  }

  // Remove OSC-8 sequences from HTML first
  let cleanHtml = removeOsc8Sequences(htmlWithAnsi);

  // Apply links in reverse order to preserve positions
  const validLinks = links
    .filter(link => isAllowedUrl(link.url, allowedSchemes))
    .sort((a, b) => b.start - a.start);

  for (const link of validLinks) {
    cleanHtml = insertHyperlink(cleanHtml, link);
  }

  return cleanHtml;
}

// Remove OSC-8 escape sequences from text
function removeOsc8Sequences(text: string): string {
  return text
    .replace(OSC8_OPEN_REGEX, '')
    .replace(OSC8_CLOSE_REGEX, '');
}

// Check if URL is valid
function isAllowedUrl(url: string, _allowedSchemes: string[]): boolean {
  try {
    new URL(url);
    // Allow all schemes - user consent is required via modal
    return true;
  } catch {
    // Invalid URL
    return false;
  }
}

// Insert hyperlink into HTML at the correct position
function insertHyperlink(html: string, link: Osc8Link): string {
  // This is a simplified approach - in reality, we'd need to carefully
  // map positions between raw text and HTML with ANSI escapes
  const linkText = escapeHtml(link.text);
  const linkUrl = escapeHtml(link.url);

  const linkHtml = `<a href="${linkUrl}" title="${linkUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;

  // For now, do a simple text replacement
  // In a more sophisticated implementation, we'd track character positions
  // through the ANSI -> HTML conversion process
  return html.replace(escapeHtml(link.text), linkHtml);
}

// Basic HTML escaping
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}