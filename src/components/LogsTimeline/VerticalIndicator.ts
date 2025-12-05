/**
 * VerticalIndicator class
 * Renders vertical lines with optional triangular brackets at top/bottom
 * Used for hover indicators, range brackets, and selection markers
 */

import { ColorScheme, colorToCSS } from '../../theme/colorSchemes';

/** Semantic type of indicator (direction determines start/end) */
export enum IndicatorType {
  Hover = 'hover',
  Selected = 'selected',
  Visible = 'visible',
  Dashboard = 'dashboard',
}

export type IndicatorDirection = 'left' | 'right' | 'point';

const DEFAULT_DASH_PATTERN = [4, 4];
const BRACKET_SIZE = 8; // Triangle size for left/right brackets

export class VerticalIndicator {
  private type: IndicatorType;
  private timestamp: number;
  private direction: IndicatorDirection;
  private color: string;
  private lineWidth: number;
  private dashed: boolean;
  private dashPattern?: number[];
  private colorIndex: number;

  constructor(
    type: IndicatorType,
    timestamp: number,
    direction: IndicatorDirection,
    colorIndex: number,
    colorScheme: ColorScheme,
    lineWidth: number,
    dashed: boolean,
    dashPattern?: number[]
  ) {
    this.type = type;
    this.timestamp = timestamp;
    this.direction = direction;
    this.colorIndex = colorIndex;
    this.color = colorToCSS(colorScheme.colors[colorIndex]);
    this.lineWidth = lineWidth;
    this.dashed = dashed;
    this.dashPattern = dashPattern;
  }

  /**
   * Render the indicator on a canvas context
   */
  render(
    ctx: CanvasRenderingContext2D,
    x: number,
    yOffset: number,
    height: number
  ): void {
    ctx.save();

    // Set up line style
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;

    if (this.dashed) {
      ctx.setLineDash(this.dashPattern || DEFAULT_DASH_PATTERN);
    }

    // Draw the vertical line
    ctx.beginPath();
    ctx.moveTo(x, yOffset);
    ctx.lineTo(x, yOffset + height);
    ctx.stroke();

    // Draw direction indicators (triangles for left/right)
    if (this.direction !== 'point') {
      this.renderBrackets(ctx, x, yOffset, height);
    }

    ctx.restore();
  }

  /**
   * Render triangular brackets at top and bottom
   */
  private renderBrackets(
    ctx: CanvasRenderingContext2D,
    x: number,
    yOffset: number,
    height: number
  ): void {
    ctx.fillStyle = this.color;
    ctx.setLineDash([]); // Solid fill for triangles

    const topY = yOffset;
    const bottomY = yOffset + height;
    const direction = this.direction === 'left' ? -1 : 1;
    const size = BRACKET_SIZE;

    // Top bracket (pointing inward)
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x + direction * size, topY);
    ctx.lineTo(x, topY + size);
    ctx.closePath();
    ctx.fill();

    // Bottom bracket (pointing inward)
    ctx.beginPath();
    ctx.moveTo(x, bottomY);
    ctx.lineTo(x + direction * size, bottomY);
    ctx.lineTo(x, bottomY - size);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Update the timestamp
   */
  setTimestamp(timestamp: number): void {
    this.timestamp = timestamp;
  }

  /**
   * Update the color
   */
  setColor(color: string): void {
    this.color = color;
  }

  /**
   * Update the color based on color scheme
   */
  setColorScheme(colorScheme: ColorScheme): void {
    this.color = colorToCSS(colorScheme.colors[this.colorIndex]);
  }

  /**
   * Check if this indicator should be visible at the given zoom range
   */
  isVisible(zoomRange: [number, number]): boolean {
    return this.timestamp >= zoomRange[0] && this.timestamp <= zoomRange[1];
  }

  /**
   * Get the timestamp this indicator is positioned at
   */
  getTimestamp(): number {
    return this.timestamp;
  }

  /**
   * Get the current direction
   */
  getDirection(): IndicatorDirection {
    return this.direction;
  }

  /**
   * Get the indicator type
   */
  getType(): IndicatorType {
    return this.type;
  }

  /**
   * Get the indicator color
   */
  getColor(): string {
    return this.color;
  }
}

/**
 * Factory functions for common indicator types
 */
export class IndicatorFactory {
  static createHover(timestamp: number, colorScheme: ColorScheme): VerticalIndicator {
    return new VerticalIndicator(
      IndicatorType.Hover,
      timestamp,
      'point',
      4, // Cyan/blue for hover
      colorScheme,
      2, // lineWidth
      true, // dashed
      [4, 4] // dashPattern
    );
  }

  static createSelection(timestamp: number, colorScheme: ColorScheme): VerticalIndicator {
    return new VerticalIndicator(
      IndicatorType.Selected,
      timestamp,
      'point',
      4, // Cyan/blue for selection
      colorScheme,
      3, // lineWidth
      false // dashed
    );
  }

  static createVisible(
    timestamp: number,
    direction: IndicatorDirection,
    colorScheme: ColorScheme
  ): VerticalIndicator {
    return new VerticalIndicator(
      IndicatorType.Visible,
      timestamp,
      direction,
      3, // Yellow/orange for visible range
      colorScheme,
      2, // lineWidth
      false // dashed
    );
  }

  static createDashboard(
    timestamp: number,
    direction: IndicatorDirection,
    colorScheme: ColorScheme
  ): VerticalIndicator {
    return new VerticalIndicator(
      IndicatorType.Dashboard,
      timestamp,
      direction,
      1, // Red for dashboard range
      colorScheme,
      2, // lineWidth
      false // dashed
    );
  }
}
