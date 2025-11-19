/**
 * Time axis for the timeline chart
 * Handles conversion between time and pixel coordinates, zoom, and rendering
 */

import { ColorScheme } from '../../theme/colorSchemes';

// Helper to convert AnsiColor to CSS color
function colorToCSS(color: { r: number; g: number; b: number }): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

interface GridSettings {
  minIntervalWidth: number;
  zoom_factor: number;
  zoom_wheel_scale: number;
  maxMicrosecondWidth: number;
  spacings: Array<{
    unit: string;
    major: string;
    base: number;
    intervals: number[];
  }>;
}

interface GridInfo {
  unit: string;
  interval: number;
  offset: number;
  minor: number;
  major: number;
}

const DEFAULT_GRID_SETTINGS: GridSettings = {
  minIntervalWidth: 80,
  zoom_factor: 0.15,
  zoom_wheel_scale: 120,
  maxMicrosecondWidth: 100,
  spacings: [
    { unit: 'μs', major: 'ms', base: 1000, intervals: [500, 200, 100, 50, 20, 10, 5, 2, 1] },
    { unit: 'ms', major: 's', base: 1000, intervals: [500, 200, 100, 50, 20, 10, 5, 2, 1] },
    { unit: 's', major: 'm', base: 60, intervals: [30, 15, 10, 5, 2, 1] },
    { unit: 'm', major: 'h', base: 60, intervals: [30, 15, 10, 5, 2, 1] },
    { unit: 'h', major: 'd', base: 24, intervals: [12, 6, 4, 3, 2, 1] },
  ],
};

export class TimeAxis {
  private chart: any;
  private width: number = 0;
  private fullRange: [number, number] | null = null;
  private zoomRange: [number, number] | null = null;
  private grid: GridInfo | null = null;
  private offsets: Record<string, number> = {};
  private dragData: { id: number; center: number } | null = null;
  private gridSettings: GridSettings;
  private colorScheme: ColorScheme;
  public y: number = 0;

  constructor(chart: any, colorScheme: ColorScheme, gridSettings?: Partial<GridSettings>) {
    this.chart = chart;
    this.colorScheme = colorScheme;
    this.gridSettings = { ...DEFAULT_GRID_SETTINGS, ...gridSettings };
  }

  /**
   * Update time range, optionally setting initial zoom
   */
  updateRange(timeRange: [number, number], initialZoom?: [number, number]): void {
    this.fullRange = [...timeRange];
    this.zoomRange = initialZoom ? [...initialZoom] : [...timeRange];

    // Calculate offsets for grid alignment
    const endUs = timeRange[1];
    const endMs = Math.floor(endUs / 1000);
    const date = new Date(endMs);

    const breakdown = {
      h: date.getHours(),
      m: date.getMinutes(),
      s: date.getSeconds(),
      ms: date.getMilliseconds(),
    };

    this.offsets = { μs: 0 };

    const dateArgs: number[] = [0, 0, 0, 0, 0, 0, 0];
    let di = 0;
    for (const interval in breakdown) {
      dateArgs[di++] = breakdown[interval as keyof typeof breakdown];
      const fd = new Date(...(dateArgs as [number, number, number, number, number, number, number]));
      const floorUs = fd.getTime() * 1000;
      this.offsets[interval] = floorUs;
    }

    this.updateGrid();
  }

  updateWidth(width: number): void {
    this.width = width;
    this.updateGrid();
  }

  /**
   * Update time grid intervals with new coordinate transform
   */
  private updateGrid(): void {
    if (!this.fullRange || !this.width) return;

    this.grid = null;
    const us = this.zoomRange![1] - this.zoomRange![0];
    const gridUs = (us / this.width) * this.gridSettings.minIntervalWidth;

    let base = 1;
    const sgs = this.gridSettings.spacings;

    for (let gi = 0; gi < sgs.length; gi++) {
      const gs = sgs[gi];
      const gridRes = Math.ceil(gridUs / base);
      let interval = gs.intervals[0];

      if (interval < gridRes) {
        base *= gs.base;
        continue;
      }

      let bestInterval = interval;
      for (let i = 1; i < gs.intervals.length; i++) {
        interval = gs.intervals[i];
        if (interval >= gridRes) {
          bestInterval = interval;
        } else {
          break;
        }
      }

      this.grid = {
        unit: gs.unit,
        interval: bestInterval,
        offset: this.offsets[gs.major] || 0,
        minor: bestInterval * base,
        major: gs.base / bestInterval,
      };
      return;
    }

    if (this.grid === null) {
      console.warn(`No suitable grid interval for ${gridUs} microseconds`);
    }
  }

  /**
   * Handle mouse drag to pan the timeline
   */
  mousedrag(evt: { id: number; start: [number, number]; end: [number, number] }): boolean {
    if (!this.zoomRange || !this.fullRange) return false;

    let d = this.dragData;
    if (d?.id !== evt.id) {
      d = this.dragData = {
        id: evt.id,
        center: this.pixel2time(evt.start[0]),
      };
    }

    const shift = d.center - this.pixel2time(evt.end[0]);
    const dur = this.zoomRange[1] - this.zoomRange[0];

    // Allow panning beyond the data range
    const z0 = this.zoomRange[0] + shift;

    if (z0 !== this.zoomRange[0]) {
      this.zoomRange = [z0, z0 + dur];
      this.chart.render();
    }

    return true; // Cancel propagation
  }

  /**
   * Handle mouse wheel to zoom
   */
  mousewheel(evt: { factor: number; shift: boolean; position: [number, number] }): boolean {
    if (!this.zoomRange || !this.fullRange || evt.shift) return false;

    const G = this.gridSettings;
    const base = 1 + Math.sign(evt.factor) * G.zoom_factor;
    const zoom = Math.pow(base, Math.abs(evt.factor / G.zoom_wheel_scale));

    const zoomDur = this.zoomRange[1] - this.zoomRange[0];
    const ctrTime = this.pixel2time(evt.position[0]);
    const ctrProp = (ctrTime - this.zoomRange[0]) / zoomDur;

    // Allow zooming beyond the data range, only limit minimum zoom level
    const newDur = Math.max(this.width / G.maxMicrosecondWidth, zoomDur * zoom);

    // Allow positioning beyond the data range
    const z0 = ctrTime - newDur * ctrProp;

    this.zoomRange = [z0, z0 + newDur];
    this.updateGrid();
    this.chart.render();

    return true; // Cancel propagation
  }

  /**
   * Convert time coordinate to pixel coords
   */
  time2pixel(t: number): number {
    if (!this.zoomRange) return 0;
    const normalized = (t - this.zoomRange[0]) / (this.zoomRange[1] - this.zoomRange[0]);
    return normalized * this.width;
  }

  /**
   * Convert pixel coordinate to time coords
   */
  pixel2time(p: number): number {
    if (!this.zoomRange) return 0;
    const normalized = p / this.width;
    return normalized * this.zoomRange[1] + (1 - normalized) * this.zoomRange[0];
  }

  /**
   * Convert time duration to pixel width
   */
  duration2pixels(d: number): number {
    if (!this.zoomRange) return 0;
    return (d / (this.zoomRange[1] - this.zoomRange[0])) * this.width;
  }

  /**
   * Get current zoom range
   */
  getZoomRange(): [number, number] | null {
    return this.zoomRange ? [...this.zoomRange] : null;
  }

  /**
   * Get full time range
   */
  getFullRange(): [number, number] | null {
    return this.fullRange ? [...this.fullRange] : null;
  }

  /**
   * Reset zoom to full range
   */
  resetZoom(): void {
    if (this.fullRange) {
      this.zoomRange = [...this.fullRange];
      this.updateGrid();
      this.chart.render();
    }
  }

  /**
   * Update the color scheme
   */
  setColorScheme(colorScheme: ColorScheme): void {
    this.colorScheme = colorScheme;
  }

  /**
   * Get height of the axis
   */
  getHeight(): number {
    return 20; // Enough for labels
  }

  /**
   * Render the time axis
   */
  render(ctx: CanvasRenderingContext2D, height: number): void {
    if (!this.grid || !this.fullRange || !this.zoomRange) {
      return;
    }

    // Draw background for axis area using bgAccent1
    const axisHeight = this.getHeight();
    ctx.fillStyle = colorToCSS(this.colorScheme.bgAccent1);
    ctx.fillRect(0, this.y, this.width, axisHeight);

    const G = this.grid;
    const halfWidth = this.duration2pixels(G.minor) / 2;

    // Find first grid line
    let n = Math.floor((this.zoomRange[0] - G.offset) / G.minor);

    // Draw grid lines and labels
    const minorPath = new Path2D();
    const majorPath = new Path2D();

    // Use foreground color or fallback for text
    ctx.fillStyle = colorToCSS(this.colorScheme.foreground);
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const ly = this.y + 5;
    let t = G.offset + n * G.minor;
    let i = 0;
    let last = false;

    while (true) {
      const x = Math.floor(this.time2pixel(t));
      const path = !(n % G.major) ? majorPath : minorPath;
      // Grid lines only extend through histogram area (0 to axis y position)
      path.moveTo(x, 0);
      path.lineTo(x, this.y);

      // Draw label
      const date = new Date(Math.floor(t / 1000));
      let label = '';
      if (G.unit === 'μs' || G.unit === 'ms') {
        label = date.toISOString().substr(11, 12);
      } else if (G.unit === 's' || G.unit === 'm' || G.unit === 'h') {
        label = date.toISOString().substr(11, 8);
      } else {
        label = date.toISOString().substr(0, 19).replace('T', ' ');
      }

      ctx.fillText(label, x + halfWidth, ly);

      if (++i > 100) {
        console.error('Too many iterations in grid rendering');
        return;
      }

      if (last) break;
      n++;
      t += G.minor;
      if (t >= this.zoomRange[1]) {
        last = true;
      }
    }

    // Draw grid lines using bgAccent colors
    ctx.lineWidth = 1;
    // Major grid lines: use bgAccent1 or fallback
    // TODO: contrast between major/minor is not very strong
    ctx.strokeStyle = colorToCSS(this.colorScheme.bgAccent3);
    ctx.stroke(majorPath);
    // Minor grid lines: use bgAccent3 or fallback
    ctx.strokeStyle = colorToCSS(this.colorScheme.bgAccent1);
    ctx.stroke(minorPath);
  }
}
