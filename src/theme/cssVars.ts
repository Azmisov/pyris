import { ColorScheme, getColorScheme, colorToCSS } from './colorSchemes';
import { XTERM_256_PALETTE } from './palette256';

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
function generatePaletteCSS(): string {
  // Fixed palette coors, omitting theme customizable ones
  let css = ":root {\n";
  for (let i = 16; i < XTERM_256_PALETTE.length; i++) {
    css += `  --ansi-color-${i}: ${colorToCSS(XTERM_256_PALETTE[i])};\n`
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
function generateThemeCSS(scheme: ColorScheme): string {
  // TODO: generate bg accent on the fly to keep bundle smaller? need to add oklab conversions, so
  // might not save any space
  let vars = [
    `--ansi-bg: ${colorToCSS(scheme.background)}`,
    `--ansi-fg: ${colorToCSS(scheme.foreground)}`,
    `--ansi-fg-muted-1: rgba(${scheme.foreground.r}, ${scheme.foreground.g}, ${scheme.foreground.b}, 0.5)`,
    `--ansi-fg-muted-2: rgba(${scheme.foreground.r}, ${scheme.foreground.g}, ${scheme.foreground.b}, 0.25)`,
    `--ansi-bg-accent-1: ${colorToCSS(scheme.bgAccent1)}`,
    `--ansi-bg-accent-2: ${colorToCSS(scheme.bgAccent2)}`,
    `--ansi-bg-accent-3: ${colorToCSS(scheme.bgAccent3)}`,
  ];
  // theme customizes the base 16 colors
  for (let i=0; i<16; i++) {
    vars.push(`--ansi-color-${i}: ${colorToCSS(scheme.colors[i])}`);
  }
  let joined_vars = vars.map(l => `  ${l};`).join('\n');
  return `:root {\n${joined_vars}\n}`;
}

// Add a singleton CSS styles element to the page, replacing if found already
function addStyles(id : string, css : string): void {
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