import { AnsiColor } from '../types';
import { ColorScheme, getColorScheme } from './colorSchemes';
import { XTERM_256_PALETTE } from './palette256';

// Convert color to CSS rgb() string
function colorToRgb(color: AnsiColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

// Apply base palette and ANSI classes to the document
export function applyPalette(): void {
  addStyles('ansi-palette', generatePaletteCSS());
}

// Apply color scheme theme to document
export function applyTheme(name: string): void {
  const scheme = getColorScheme(name);
  const css = generateThemeCSS(scheme);
  addStyles('ansi-panel-theme', css);
}

// Generate base palette CSS variables and classes, which don't depend on a selected theme
export function generatePaletteCSS(): string {
  // Fixed palette coors, omitting theme customizable ones
  let css = ":root {\n";
  for (let i = 16; i < XTERM_256_PALETTE.length; i++) {
    css += `  --ansi-color-${i}: ${colorToRgb(XTERM_256_PALETTE[i])};\n`
  }
  css += "}\n\n";

  // Classes which use palette colors
  for (let i = 0; i < XTERM_256_PALETTE.length; i++) {
    css += `.ansi-fg-${i} { color: var(--ansi-color-${i}); }\n`;
    css += `.ansi-bg-${i} { background-color: var(--ansi-color-${i}); }\n`;
    css += `.ansi-underline-color-${i} { text-decoration-color: var(--ansi-color-${i}); }\n`;
  }

  return css;
}

// Generate CSS variables for theme
export function generateThemeCSS(scheme: ColorScheme): string {
  // TODO: generate bg accent on the fly to keep bundle smaller? need to add oklab conversions, so
  // might not save any space
  let vars = [
    `--ansi-bg: ${colorToRgb(scheme.background)}`,
    `--ansi-fg: ${colorToRgb(scheme.foreground)}`,
    `--ansi-fg-muted-1: rgba(${scheme.foreground.r}, ${scheme.foreground.g}, ${scheme.foreground.b}, 0.5)`,
    `--ansi-fg-muted-2: rgba(${scheme.foreground.r}, ${scheme.foreground.g}, ${scheme.foreground.b}, 0.25)`,
    `--ansi-bg-accent-1: ${colorToRgb(scheme.bgAccent1)}`,
    `--ansi-bg-accent-2: ${colorToRgb(scheme.bgAccent2)}`,
    `--ansi-bg-accent-3: ${colorToRgb(scheme.bgAccent3)}`,
  ];
  // theme customizes the base 16 colors
  for (let i=0; i<16; i++) {
    vars.push(`--ansi-color-${i}: ${colorToRgb(scheme.colors[i])}`);
  }
  let joined_vars = vars.map(l => `  ${l};`).join('\n');
  return `:root {\n${joined_vars}\n}`;
}

// Add a singleton CSS styles element to the page, replacing if found already
export function addStyles(id : string, css : string): void {
  // Remove if already present
  const existingStyle = document.getElementById(id);
  if (existingStyle) {
    existingStyle.remove();
  }
  // Create anew
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}