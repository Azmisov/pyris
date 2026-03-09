import { getColorScheme, colorToCSS } from './colorSchemes';
import { XTERM_256_PALETTE } from './palette256';

// Generate base palette CSS variables (fixed colors 16-255, theme-independent)
// Applied as inline style on the plugin container
export function generatePaletteVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (let i = 16; i < XTERM_256_PALETTE.length; i++) {
    vars[`--ansi-color-${i}`] = colorToCSS(XTERM_256_PALETTE[i]);
  }
  return vars;
}

// Generate theme CSS variables (colors 0-15 + bg/fg/accent)
// Applied as inline style on the plugin container
export function generateThemeVars(name: string): Record<string, string> {
  const scheme = getColorScheme(name);
  const vars: Record<string, string> = {
    '--logs-bg': colorToCSS(scheme.background),
    '--logs-fg': colorToCSS(scheme.foreground),
    '--logs-fg-muted-1': `rgba(${scheme.foreground.r}, ${scheme.foreground.g}, ${scheme.foreground.b}, 0.5)`,
    '--logs-fg-muted-2': `rgba(${scheme.foreground.r}, ${scheme.foreground.g}, ${scheme.foreground.b}, 0.25)`,
    '--logs-bg-accent-1': colorToCSS(scheme.bgAccent1),
    '--logs-bg-accent-2': colorToCSS(scheme.bgAccent2),
    '--logs-bg-accent-3': colorToCSS(scheme.bgAccent3),
  };
  for (let i = 0; i < 16; i++) {
    vars[`--ansi-color-${i}`] = colorToCSS(scheme.colors[i]);
  }
  return vars;
}
