import { AnsiColor } from '../types';
import goghThemes from './gogh-themes.json';

/**
 * Color scheme for base 16 ANSI colors plus optional background/foreground
 * Indices: 0-7 (normal), 8-15 (bright), 16 (background), 17 (foreground), 18-20 (bg accents)
 */
export interface ColorScheme {
  name: string;
  colors: AnsiColor[];
  background?: AnsiColor;  // Optional theme background color
  foreground?: AnsiColor;  // Optional theme foreground (text) color
  bgAccent1?: AnsiColor;   // Background accent color (largest shift, for primary hover/active)
  bgAccent2?: AnsiColor;   // Background accent color (medium shift, for secondary states)
  bgAccent3?: AnsiColor;   // Background accent color (smallest shift, for subtle states)
  dark: boolean;           // Whether this is a dark theme
}

// Helper to create color from hex
function hex(hexString: string): AnsiColor {
  const hex = hexString.replace('#', '');
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

/**
 * Convert Gogh theme to ColorScheme format
 */
function convertGoghTheme(name: string, colors: string[], dark: boolean): ColorScheme {
  const scheme: ColorScheme = {
    name,
    colors: colors.slice(0, 16).map(hex),
    dark,
  };

  // Add optional background and foreground colors
  if (colors[16]) {
    scheme.background = hex(colors[16]);
  }
  if (colors[17]) {
    scheme.foreground = hex(colors[17]);
  }

  // Add optional background accent colors
  if (colors[18]) {
    scheme.bgAccent1 = hex(colors[18]);
  }
  if (colors[19]) {
    scheme.bgAccent2 = hex(colors[19]);
  }
  if (colors[20]) {
    scheme.bgAccent3 = hex(colors[20]);
  }

  return scheme;
}

/**
 * All available color schemes (loaded from Gogh themes)
 */
export const COLOR_SCHEMES: Record<string, ColorScheme> = Object.fromEntries(
  Object.entries(goghThemes).map(([key, theme]) => [
    key,
    convertGoghTheme(theme.name, theme.colors, theme.dark),
  ])
);

/**
 * Get color scheme by name
 */
export function getColorScheme(name: string): ColorScheme {
  return COLOR_SCHEMES[name] || COLOR_SCHEMES['default'] || Object.values(COLOR_SCHEMES)[0];
}

/**
 * Get only dark color schemes
 */
export function getDarkColorSchemes(): Record<string, ColorScheme> {
  return Object.fromEntries(
    Object.entries(COLOR_SCHEMES).filter(([_, scheme]) => scheme.dark)
  );
}

/**
 * Get only light color schemes
 */
export function getLightColorSchemes(): Record<string, ColorScheme> {
  return Object.fromEntries(
    Object.entries(COLOR_SCHEMES).filter(([_, scheme]) => !scheme.dark)
  );
}

/**
 * Get dark color scheme options for UI (sorted by name)
 */
export function getDarkColorSchemeOptions(): Array<{ value: string; label: string }> {
  return Object.entries(getDarkColorSchemes())
    .map(([key, scheme]) => ({
      value: key,
      label: scheme.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Get light color scheme options for UI (sorted by name)
 */
export function getLightColorSchemeOptions(): Array<{ value: string; label: string }> {
  return Object.entries(getLightColorSchemes())
    .map(([key, scheme]) => ({
      value: key,
      label: scheme.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Detect system theme preference
 */
export function getSystemThemeMode(): 'dark' | 'light' {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get the effective theme mode based on user selection
 */
export function getEffectiveThemeMode(mode: 'dark' | 'light' | 'system'): 'dark' | 'light' {
  if (mode === 'system') {
    return getSystemThemeMode();
  }
  return mode;
}

/**
 * Get the active color scheme name based on theme mode settings
 * Returns the appropriate theme based on themeMode, darkTheme, and lightTheme
 */
export function getActiveColorScheme(
  themeMode: 'dark' | 'light' | 'system',
  darkTheme: string,
  lightTheme: string
): string {
  // Use theme mode to select appropriate theme
  const effectiveMode = getEffectiveThemeMode(themeMode);
  const selectedTheme = effectiveMode === 'dark' ? darkTheme : lightTheme;

  // Verify the selected theme exists, otherwise fall back
  if (COLOR_SCHEMES[selectedTheme]) {
    return selectedTheme;
  }

  // Final fallback: find first matching theme for the mode
  const fallbackSchemes = effectiveMode === 'dark'
    ? getDarkColorSchemes()
    : getLightColorSchemes();

  const firstKey = Object.keys(fallbackSchemes)[0];
  return firstKey || 'nord';
}
