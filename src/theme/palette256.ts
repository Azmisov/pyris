import { AnsiColor, ColorPalette } from '../types';
import { getColorScheme } from './colorSchemes';

// Standard xterm-256 color palette
// First 16 colors (0-15): standard ANSI colors (can be customized via color scheme)
// Colors 16-231: 216 color cube (6x6x6)
// Colors 232-255: grayscale ramp

// Base palette starts with default 16 colors
const BASE_16_COLORS: ColorPalette = [
  // Standard colors (0-15)
  { r: 0, g: 0, b: 0 },       // 0: black
  { r: 205, g: 49, b: 49 },   // 1: red
  { r: 13, g: 188, b: 121 },  // 2: green
  { r: 229, g: 229, b: 16 },  // 3: yellow
  { r: 36, g: 114, b: 200 },  // 4: blue
  { r: 188, g: 63, b: 188 },  // 5: magenta
  { r: 17, g: 168, b: 205 },  // 6: cyan
  { r: 229, g: 229, b: 229 }, // 7: white
  { r: 102, g: 102, b: 102 }, // 8: bright black
  { r: 241, g: 76, b: 76 },   // 9: bright red
  { r: 35, g: 209, b: 139 },  // 10: bright green
  { r: 245, g: 245, b: 67 },  // 11: bright yellow
  { r: 59, g: 142, b: 234 },  // 12: bright blue
  { r: 214, g: 112, b: 214 }, // 13: bright magenta
  { r: 41, g: 184, b: 219 },  // 14: bright cyan
  { r: 255, g: 255, b: 255 }, // 15: bright white
];

export const XTERM_256_PALETTE: ColorPalette = [...BASE_16_COLORS];

// Generate 216 color cube (16-231)
function generateColorCube(): AnsiColor[] {
  const colors: AnsiColor[] = [];
  const values = [0, 95, 135, 175, 215, 255];

  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        colors.push({
          r: values[r],
          g: values[g],
          b: values[b]
        });
      }
    }
  }

  return colors;
}

// Generate grayscale ramp (232-255)
function generateGrayscaleRamp(): AnsiColor[] {
  const colors: AnsiColor[] = [];

  for (let i = 0; i < 24; i++) {
    const value = 8 + i * 10;
    colors.push({ r: value, g: value, b: value });
  }

  return colors;
}

// Complete 256-color palette
const colorCube = generateColorCube();
const grayscaleRamp = generateGrayscaleRamp();
XTERM_256_PALETTE.push(...colorCube, ...grayscaleRamp);

// Convert color to CSS rgb() string
export function colorToRgb(color: AnsiColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/**
 * Create a palette with a custom color scheme applied to the first 16 colors
 */
export function getPaletteWithScheme(schemeName: string = 'default'): ColorPalette {
  const scheme = getColorScheme(schemeName);
  const palette = [...XTERM_256_PALETTE];

  // Replace first 16 colors with the scheme colors
  for (let i = 0; i < 16; i++) {
    palette[i] = scheme.colors[i];
  }

  return palette;
}

// Adjust colors for light/dark themes
export function adjustColorForTheme(color: AnsiColor, theme: 'light' | 'dark'): AnsiColor {
  if (theme === 'light') {
    // For light themes, darken bright colors for better contrast
    const factor = 0.8;
    return {
      r: Math.floor(color.r * factor),
      g: Math.floor(color.g * factor),
      b: Math.floor(color.b * factor)
    };
  } else {
    // For dark themes, brighten dark colors
    const factor = 1.2;
    return {
      r: Math.min(255, Math.floor(color.r * factor)),
      g: Math.min(255, Math.floor(color.g * factor)),
      b: Math.min(255, Math.floor(color.b * factor))
    };
  }
}