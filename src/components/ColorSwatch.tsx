import React, { memo } from 'react';
import { ColorScheme } from '../theme/colorSchemes';
import styles from './ColorSwatch.module.css';

interface ColorSwatchProps {
  scheme: ColorScheme;
  className?: string;
}

/**
 * Renders a compact horizontal strip of color bars representing a theme's palette
 * Shows 10 colors: foreground, background, red, green, yellow, blue, magenta, cyan, black, white
 * Background is set to theme background to show color contrast
 */
export const ColorSwatch = memo<ColorSwatchProps>(({ scheme, className = '' }) => {
  const background = scheme.background || scheme.colors[0]; // fallback to black if no background

  // Get colors in order: fg, red(1), green(2), yellow(3), blue(4), magenta(5), cyan(6), black(0), white(7)
  // Note: We skip background since it's shown as the strip background
  const colors = [
    scheme.foreground || scheme.colors[7], // fallback to white if no foreground
    scheme.colors[0],  // black
    scheme.colors[1],  // red
    scheme.colors[2],  // green
    scheme.colors[3],  // yellow
    scheme.colors[4],  // blue
    scheme.colors[5],  // magenta
    scheme.colors[6],  // cyan
    scheme.colors[7],  // white
  ];

  return (
    <span
      className={`${styles.strip} ${className}`}
      style={{
        backgroundColor: `rgb(${background.r}, ${background.g}, ${background.b})`,
      }}
    >
      {colors.map((color, index) => (
        <span
          key={index}
          className={styles.bar}
          style={{
            backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`,
          }}
        />
      ))}
    </span>
  );
});

ColorSwatch.displayName = 'ColorSwatch';
