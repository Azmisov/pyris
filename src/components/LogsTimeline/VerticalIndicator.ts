/**
 * VerticalIndicator class
 * Renders vertical lines with optional triangular brackets at top/bottom
 * Used for hover indicators, range brackets, and selection markers
 */

/** Semantic type of indicator (direction determines start/end) */
export enum IndicatorType {
  Hover = 'hover',
  Selected = 'selected',
  Visible = 'visible',
  Dashboard = 'dashboard',
}

export type IndicatorDirection = 'left' | 'right' | 'point';

export interface IndicatorStyle {
  color: string;
  lineWidth: number;
  dashed: boolean;
  dashPattern?: number[];
}

export interface VerticalIndicatorConfig {
  type: IndicatorType;
  timestamp: number;
  direction: IndicatorDirection;
  style: IndicatorStyle;
}

const DEFAULT_DASH_PATTERN = [4, 4];
const BRACKET_SIZE = 8; // Triangle size for left/right brackets

export class VerticalIndicator {
  private config: VerticalIndicatorConfig;

  constructor(config: VerticalIndicatorConfig) {
    this.config = config;
  }

  /**
   * Update the configuration
   */
  updateConfig(config: Partial<VerticalIndicatorConfig>): void {
    this.config = { ...this.config, ...config };
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
    ctx.strokeStyle = this.config.style.color;
    ctx.lineWidth = this.config.style.lineWidth;

    if (this.config.style.dashed) {
      ctx.setLineDash(this.config.style.dashPattern || DEFAULT_DASH_PATTERN);
    }

    // Draw the vertical line
    ctx.beginPath();
    ctx.moveTo(x, yOffset);
    ctx.lineTo(x, yOffset + height);
    ctx.stroke();

    // Draw direction indicators (triangles for left/right)
    if (this.config.direction !== 'point') {
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
    ctx.fillStyle = this.config.style.color;
    ctx.setLineDash([]); // Solid fill for triangles

    const topY = yOffset;
    const bottomY = yOffset + height;
    const direction = this.config.direction === 'left' ? -1 : 1;
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
   * Check if this indicator should be visible at the given zoom range
   */
  isVisible(zoomRange: [number, number]): boolean {
    return this.config.timestamp >= zoomRange[0] && this.config.timestamp <= zoomRange[1];
  }

  /**
   * Get the timestamp this indicator is positioned at
   */
  getTimestamp(): number {
    return this.config.timestamp;
  }

  /**
   * Get the current direction
   */
  getDirection(): IndicatorDirection {
    return this.config.direction;
  }

  /**
   * Get the indicator type
   */
  getType(): IndicatorType {
    return this.config.type;
  }

  /**
   * Get the indicator color
   */
  getColor(): string {
    return this.config.style.color;
  }
}

/**
 * Factory functions for common indicator types
 */
export class IndicatorFactory {
  static createHover(timestamp: number, color: string): VerticalIndicator {
    return new VerticalIndicator({
      type: IndicatorType.Hover,
      timestamp,
      direction: 'point',
      style: { color, lineWidth: 2, dashed: true, dashPattern: [4, 4] },
    });
  }

  static createSelection(timestamp: number, color: string): VerticalIndicator {
    return new VerticalIndicator({
      type: IndicatorType.Selected,
      timestamp,
      direction: 'point',
      style: { color, lineWidth: 3, dashed: false },
    });
  }

  static createVisibleStart(timestamp: number, color: string): VerticalIndicator {
    return new VerticalIndicator({
      type: IndicatorType.Visible,
      timestamp,
      direction: 'right',
      style: { color, lineWidth: 2, dashed: false },
    });
  }

  static createVisibleEnd(timestamp: number, color: string): VerticalIndicator {
    return new VerticalIndicator({
      type: IndicatorType.Visible,
      timestamp,
      direction: 'left',
      style: { color, lineWidth: 2, dashed: false },
    });
  }

  static createDashboardStart(timestamp: number, color: string): VerticalIndicator {
    return new VerticalIndicator({
      type: IndicatorType.Dashboard,
      timestamp,
      direction: 'right',
      style: { color, lineWidth: 2, dashed: false },
    });
  }

  static createDashboardEnd(timestamp: number, color: string): VerticalIndicator {
    return new VerticalIndicator({
      type: IndicatorType.Dashboard,
      timestamp,
      direction: 'left',
      style: { color, lineWidth: 2, dashed: false },
    });
  }
}
