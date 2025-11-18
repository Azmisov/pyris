import { ColorPalette, AnsiColor } from '../types';
import { colorToRgb, adjustColorForTheme, getPaletteWithScheme } from './palette256';
import { getColorScheme } from './colorSchemes';

// CSS variable names for ANSI colors
export const ANSI_CSS_VARS = {
  // Foreground colors
  fg: (index: number) => `--ansi-fg-${index}`,
  // Background colors
  bg: (index: number) => `--ansi-bg-${index}`,
  // Text styling
  bold: '--ansi-bold-weight',
  italic: '--ansi-italic-style',
  underline: '--ansi-underline-style',
  // Theme colors
  background: '--ansi-panel-bg',
  foreground: '--ansi-panel-fg',
  fgMuted1: '--ansi-panel-fg-muted1',
  fgMuted2: '--ansi-panel-fg-muted2',
  border: '--ansi-panel-border',
  scrollbar: '--ansi-scrollbar',
  selection: '--ansi-selection-bg',
  // Background accent colors (lighter for dark, darker for light)
  bgAccent1: '--ansi-bg-accent-1',
  bgAccent2: '--ansi-bg-accent-2',
  bgAccent3: '--ansi-bg-accent-3',
};

// Apply palette theme to document
export function applyPaletteTheme(
  theme: 'light' | 'dark' = 'dark',
  colorScheme: string = 'gogh'
): void {
  const css = generateThemeCSS(theme, colorScheme);

  // Remove existing ansi theme
  const existingStyle = document.getElementById('ansi-panel-theme');
  if (existingStyle) {
    existingStyle.remove();
  }

  // Add new theme (only CSS variables, not structural styles)
  const style = document.createElement('style');
  style.id = 'ansi-panel-theme';
  style.textContent = css;
  document.head.appendChild(style);
}

// Generate only CSS variables for theme (no structural CSS)
export function generateThemeCSS(
  theme: 'light' | 'dark' = 'dark',
  colorScheme: string = 'gogh'
): string {
  // Get palette with custom color scheme applied
  const palette = getPaletteWithScheme(colorScheme);

  // Get the color scheme object for background/foreground colors
  const scheme = getColorScheme(colorScheme);

  return `
:root {
${generateThemeVariables(theme, scheme)}
${generateColorVariables(palette, theme)}
}

${generateColorClasses(palette)}
`;
}

// Generate base theme variables
export function generateThemeVariables(
  theme: 'light' | 'dark',
  scheme?: {
    background?: AnsiColor;
    foreground?: AnsiColor;
    bgAccent1?: AnsiColor;
    bgAccent2?: AnsiColor;
    bgAccent3?: AnsiColor;
  }
): string {
  // Default fallback colors
  const defaults = theme === 'light' ? {
    background: '#ffffff',
    foreground: '#000000',
    border: '#e1e5e9',
    scrollbar: '#c1c7cd',
    selection: 'rgba(0, 123, 255, 0.25)',
  } : {
    background: '#1f1f23',
    foreground: '#ffffff',
    border: '#3c3c41',
    scrollbar: '#5c5c61',
    selection: 'rgba(0, 123, 255, 0.35)',
  };

  // Use theme-specific background/foreground if available
  const background = scheme?.background
    ? colorToRgb(scheme.background)
    : defaults.background;

  const foreground = scheme?.foreground
    ? colorToRgb(scheme.foreground)
    : defaults.foreground;

  // Generate muted foreground (50% alpha)
  const fgMuted1 = scheme?.foreground
    ? `rgba(${scheme.foreground.r}, ${scheme.foreground.g}, ${scheme.foreground.b}, 0.5)`
    : theme === 'light' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';

  // Generate more muted foreground (25% alpha)
  const fgMuted2 = scheme?.foreground
    ? `rgba(${scheme.foreground.r}, ${scheme.foreground.g}, ${scheme.foreground.b}, 0.25)`
    : theme === 'light' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.25)';

  // Use accent colors if available, otherwise fall back to background
  const bgAccent1 = scheme?.bgAccent1
    ? colorToRgb(scheme.bgAccent1)
    : background;

  const bgAccent2 = scheme?.bgAccent2
    ? colorToRgb(scheme.bgAccent2)
    : background;

  const bgAccent3 = scheme?.bgAccent3
    ? colorToRgb(scheme.bgAccent3)
    : background;

  return `
  ${ANSI_CSS_VARS.background}: ${background};
  ${ANSI_CSS_VARS.foreground}: ${foreground};
  ${ANSI_CSS_VARS.fgMuted1}: ${fgMuted1};
  ${ANSI_CSS_VARS.fgMuted2}: ${fgMuted2};
  ${ANSI_CSS_VARS.border}: ${defaults.border};
  ${ANSI_CSS_VARS.scrollbar}: ${defaults.scrollbar};
  ${ANSI_CSS_VARS.selection}: ${defaults.selection};
  ${ANSI_CSS_VARS.bgAccent1}: ${bgAccent1};
  ${ANSI_CSS_VARS.bgAccent2}: ${bgAccent2};
  ${ANSI_CSS_VARS.bgAccent3}: ${bgAccent3};
  ${ANSI_CSS_VARS.bold}: 600;
  ${ANSI_CSS_VARS.italic}: italic;
  ${ANSI_CSS_VARS.underline}: underline;
`;
}

// Generate CSS custom properties for color palette
export function generateColorVariables(
  palette: ColorPalette,
  theme: 'light' | 'dark' = 'dark'
): string {
  const adjustedPalette = palette.map(color =>
    adjustColorForTheme(color, theme)
  );

  let css = '';

  // Foreground colors
  adjustedPalette.forEach((color, index) => {
    css += `  ${ANSI_CSS_VARS.fg(index)}: ${colorToRgb(color)};\n`;
  });

  // Background colors (slightly transparent for layering)
  adjustedPalette.forEach((color, index) => {
    css += `  ${ANSI_CSS_VARS.bg(index)}: ${colorToRgb(color)};\n`;
  });

  return css;
}

export function generateColorClasses(palette: ColorPalette): string {
  let css = '';

  palette.forEach((color, index) => {
    css += `.ansi-fg-${index} { color: var(${ANSI_CSS_VARS.fg(index)}); }\n`;
    css += `.ansi-bg-${index} { background-color: var(${ANSI_CSS_VARS.bg(index)}); }\n`;
    css += `.ansi-underline-color-${index} { text-decoration-color: var(${ANSI_CSS_VARS.fg(index)}); }\n`;
  });

  return css;
}