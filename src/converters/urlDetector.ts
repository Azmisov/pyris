// URL detection and auto-linking for plain text

// Regular expression to match URLs in plain text
// Matches schemes with :// or safe colon-only schemes (mailto, tel, sms, callto)
// Excludes dangerous schemes like javascript:, data:, vbscript:
const URL_REGEX = /\b((?:[a-z][a-z0-9+.-]{2,}):\/\/[^\s<>"'{}|\\^`\[\]]+|(?:mailto|tel|sms|callto):[^\s<>"'{}|\\^`\[\]]+)/gi;

interface DetectedLink {
  url: string;
  text: string;
  start: number;
  end: number;
}

/**
 * Detect plain URLs in text (not wrapped in OSC-8)
 * Returns an array of detected URLs with their positions
 */
function detectPlainUrls(text: string): DetectedLink[] {
  const links: DetectedLink[] = [];
  const regex = new RegExp(URL_REGEX);
  let match;

  while ((match = regex.exec(text)) !== null) {
    links.push({
      url: match[1],
      text: match[1],
      start: match.index,
      end: match.index + match[1].length,
    });
  }

  return links;
}

/**
 * Wrap plain URLs in HTML anchor tags
 * This is applied to HTML that already has ANSI formatting
 * Skips URLs that are already inside anchor tags
 */
export function linkifyPlainUrls(html: string, allowedSchemes: string[]): string {
  // First, find all existing anchor tag ranges to avoid double-wrapping
  const anchorRanges = findAnchorRanges(html);

  const links = detectPlainUrls(html);

  if (links.length === 0) {
    return html;
  }

  // Filter links - check they're not already in anchor tags
  const validLinks = links.filter(link => {
    // Check if already inside an anchor tag
    if (isInsideAnchorTag(link.start, link.end, anchorRanges)) {
      return false;
    }

    try {
      new URL(link.url);
      // Allow all schemes - user consent is required via modal
      return true;
    } catch {
      return false;
    }
  });

  if (validLinks.length === 0) {
    return html;
  }

  // Apply links in reverse order to preserve positions
  validLinks.sort((a, b) => b.start - a.start);

  let result = html;
  for (const link of validLinks) {
    const before = result.substring(0, link.start);
    const after = result.substring(link.end);
    const linkHtml = createLinkHtml(link.url, link.text);
    result = before + linkHtml + after;
  }

  return result;
}

/**
 * Find all anchor tag ranges in HTML to avoid double-wrapping
 */
function findAnchorRanges(html: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const anchorRegex = /<a\s[^>]*>.*?<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return ranges;
}

/**
 * Check if a range is inside any anchor tag
 */
function isInsideAnchorTag(
  start: number,
  end: number,
  anchorRanges: Array<{ start: number; end: number }>
): boolean {
  return anchorRanges.some(
    range => start >= range.start && end <= range.end
  );
}

/**
 * Create HTML anchor tag with proper attributes
 */
function createLinkHtml(url: string, text: string): string {
  const escapedUrl = escapeHtml(url);
  const escapedText = escapeHtml(text);

  return `<a href="${escapedUrl}" title="${escapedUrl}" class="ansi-detected-link" target="_blank" rel="noopener noreferrer" data-url="${escapedUrl}">${escapedText}</a>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
