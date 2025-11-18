/**
 * Font sizing utilities for calculating optimal font size based on desired row height.
 *
 * This ensures pixel-perfect alignment of text rows by calculating the exact font size
 * needed to make a font's bounding box render at the target height.
 */

/**
 * Calculates the font size needed to make the font's box render at a desired height.
 *
 * @param fontFamily - The CSS font-family string
 * @param targetHeight - The desired (integer) pixel height
 * @param char - The character to measure (default: '█')
 * @returns Font size in pixels
 */
export function calculateFontSize(
  fontFamily: string,
  targetHeight: number,
  char: string = '█'
): number {
  // Setup Canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.warn('Could not get canvas context for font measurement');
    // Fallback to a simple ratio
    return targetHeight / 1.13;
  }

  const testSize = 1000; // Use a large size for precision

  // Measure at test size
  ctx.font = `${testSize}px ${fontFamily}`;
  const metrics = ctx.measureText(char);

  let testAscent = metrics.fontBoundingBoxAscent;
  let testDescent = metrics.fontBoundingBoxDescent;

  // Fallback: Some fonts (or browsers) don't report fontBoundingBox.
  // If it's 0, fall back to the (less accurate for this trick) actualBoundingBox.
  if (!testAscent && !testDescent) {
    console.warn(`Font "${fontFamily}" returned 0 for fontBoundingBox. Falling back to actualBoundingBox.`);
    testAscent = metrics.actualBoundingBoxAscent;
    testDescent = metrics.actualBoundingBoxDescent;
  }

  // Handle fonts that don't support the character or return 0
  const testGlyphHeight = testAscent + testDescent;
  if (!testGlyphHeight || testGlyphHeight === 0) {
    console.warn(`Font "${fontFamily}" may not support '${char}' or reports zero height.`);
    return targetHeight / 1.13;
  }

  return targetHeight * testSize / testGlyphHeight;
}

/**
 * Applies font sizing CSS variables to an element
 *
 * @param element - The DOM element to apply variables to
 * @param rowHeight - The desired row height in pixels
 * @param fontFamily - Optional font family to use (defaults to monospace stack)
 */
export function applyFontSizeVars(
  element: HTMLElement,
  rowHeight: number,
  fontFamily: string
): void {
  const fontSize = calculateFontSize(fontFamily, rowHeight);
  element.style.setProperty('--ansi-logs-row-height', `${rowHeight}px`);
  element.style.setProperty('--ansi-logs-row-font-size', `${fontSize}px`);
  element.style.setProperty('--ansi-logs-row-font-family', fontFamily);
}
