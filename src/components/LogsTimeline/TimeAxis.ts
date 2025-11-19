/**
 * Time axis for the timeline chart
 * Handles conversion between time and pixel coordinates, zoom, and rendering
 */

import { ColorScheme } from '../../theme/colorSchemes';

// Helper to convert AnsiColor to CSS color
function colorToCSS(color: { r: number; g: number; b: number }): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/** Pad number with N digits */
export function pad(num: number, digits: number): string {
	return String(num).padStart(digits, '0');
}

/** Given microsecond time since 1970 epoch, output string parts */
function format_time(t: number) : { date: string, time: string, ms: string, us: string } {
	const ms = Math.floor(t/1000);
	const us = Math.floor(t%1000);
	const d = new Date(ms);
	return {
		date: `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`,
		time: `${pad(d.getHours(),2)}:${pad(d.getMinutes(),2)}:${pad(d.getSeconds(),2)}`,
		ms: pad(d.getMilliseconds(),4),
		us: pad(us,4)
	};
}
/** Same as format_time, but not as parts */
export function format_time_full(t: number) : string {
	const parts = format_time(t);
	return `${parts.date} ${parts.time} / ${parts.ms} / ${parts.us}`;
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

/**
 * For time scale, breaking it into multiples of 1/5 is easy to understand; e.g. a grid marking
 * every 5min > 1min > 5 sec, 50ms. We specify what the minimum grid interval is, then round to the
 * nearest time interval >= that corresponds to that pixel separation. The next largest whole
 * interval (microsecond, millisecond, second, minute...) gets bolded/emphasized grid lines; e.g. if
 * grid is every 10min, we bold every hour mark.
 */
const DEFAULT_GRID_SETTINGS: GridSettings = {
  minIntervalWidth: 80,
  zoom_factor: 0.15,
  zoom_wheel_scale: 120,
  maxMicrosecondWidth: 100,
  spacings: [
    // intervals of 1/5 are easy to understand
    { unit: 'μs', major: 'ms', base: 1000, intervals: [500, 200, 100, 50, 20, 10, 5, 2, 1] },
    { unit: 'ms', major: 's', base: 1000, intervals: [500, 200, 100, 50, 20, 10, 5, 2, 1] },
    // typical wall clock divisions
    { unit: 's', major: 'm', base: 60, intervals: [30, 15, 10, 5, 2, 1] },
    { unit: 'm', major: 'h', base: 60, intervals: [30, 15, 10, 5, 2, 1] },
    // 8 to match typical workday; 12 for sensible noon/midnight division
    { unit: 'h', major: 'd', base: 24, intervals: [12, 8, 4, 2, 1] },
    { unit: 'd', major: 'M', base: 30, intervals: [15, 10, 5, 2, 1] },
    // quartarly and mid-year divisions
    { unit: 'M', major: 'y', base: 12, intervals: [6, 4, 2, 1] },
    { unit: 'y', major: 'y', base: 10, intervals: [5, 2, 1] },
  ],
};

export class TimeAxis {
  private chart: any;
  private width: number = 0;
  private fullRange: [number, number] | null = null;
  private zoomRange: [number, number] | null = null;
  private grid: GridInfo | null = null;
  private offsets: Record<string, number> = {};
  /** Timezone offset in hours */
  private tzOffset: number = 0;
  /** Holds dragging state; see mousedrag */
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

    /* Calculate offsets needed to get to the first whole interval <= end of time range. Times
       will represent UTC +/- a fixed local offset given by end time. We go off end time since
       probably closer to current wall clock offset. Once whole intervals are found, we assume
       consistent 1000*1000*60*60*24 microseconds in a day, and so can inc/decrement by the
       unit's microsecond base to get intervals. */
    const endUs = timeRange[1];
    const endMs = Math.floor(endUs / 1000);
    const date = new Date(endMs);

    const breakdown = {
      // year/month/day won't get used currently
      y: date.getFullYear(),
      M: date.getMonth(),
      d: date.getDate(),
      h: date.getHours(),
      m: date.getMinutes(),
      // JS doesn't have leapseconds so could handle these manually;
      // will include to keep code simpler
      s: date.getSeconds(),
      ms: date.getMilliseconds(),
    };

    this.offsets = { μs: 0 };
    /** Timezone offset in hours */
    this.tzOffset = -date.getTimezoneOffset() / 60;

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
   * Update time grid intervals with new coordinate transform. This is triggered any time the zoom
   * range changes, as the grid intervals are computed based on the axis range.
   */
  private updateGrid(): void {
    if (!this.fullRange || !this.width) return;

    this.grid = null;
    // Microseconds rendered
    const us = this.zoomRange![1] - this.zoomRange![0];
    // Min microseconds per grid interval
    const gridUs = (us / this.width) * this.gridSettings.minIntervalWidth;

    // Find nearest whole marker
    let base = 1;
    const sgs = this.gridSettings.spacings;

    for (let gi = 0; gi < sgs.length; gi++) {
      const gs = sgs[gi];
      // Convert grid_us to grid_[gs.unit]
      const gridRes = Math.ceil(gridUs / base);
      let interval = gs.intervals[0];

      // Grid spacing too small to accommodate min
      if (interval < gridRes) {
        base *= gs.base;
        continue;
      }

      // Unit is sufficient; find min interval >= grid_res
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
        // Units for minor grid intervals
        unit: gs.unit,
        // Interval per minor grid unit, in `units`
        interval: bestInterval,
        // End time where grid interval starts
        offset: this.offsets[gs.major] || 0,
        // Microseconds per minor interval
        minor: bestInterval * base,
        // Multiples of minor that make up a major interval
        major: gs.base / bestInterval,
      };
      return;
    }

    if (this.grid === null) {
      console.warn(`No suitable grid interval for ${gridUs} microseconds`);
    }
  }

  /**
   * Shift the timeline forward/backward. Zoom duration remains unchanged, so the grid doesn't
   * need to be recalculated.
   */
  mousedrag(evt: { id: number; start: [number, number]; end: [number, number] }): boolean {
    if (!this.zoomRange || !this.fullRange) return false;

    // New drag; mark starting time to be the fixed reference for drag
    let d = this.dragData;
    if (d?.id !== evt.id) {
      d = this.dragData = {
        id: evt.id,
        center: this.pixel2time(evt.start[0]),
      };
    }

    // Shift d.center to match current mouse position
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
   * Zoom in/out centered at mouse position
   */
  mousewheel(evt: { factor: number; shift: boolean; position: [number, number] }): boolean {
    // Shift scroll for component-specific panning
    if (!this.zoomRange || !this.fullRange || evt.shift) return false;

    // Desired zoom factor
    const G = this.gridSettings;
    const base = 1 + Math.sign(evt.factor) * G.zoom_factor;
    const zoom = Math.pow(base, Math.abs(evt.factor / G.zoom_wheel_scale));

    // Treat zoom as a scale of the duration; then we shift to proper position afterwards
    const zoomDur = this.zoomRange[1] - this.zoomRange[0];
    const ctrTime = this.pixel2time(evt.position[0]);
    const ctrProp = (ctrTime - this.zoomRange[0]) / zoomDur;

    // New duration, with limits applied
    const newDur = Math.max(this.width / G.maxMicrosecondWidth, zoomDur * zoom);

    /* Calculate shift to keep time fixed at mouse pos
        new_dur*ctr_prop + z0 = ctr_time
      Could implement clamping on this line, but we don't clamp currently
      clamping:
				[ [-----x--]--] z0 < f0
				[--[----x--]  ] z0+new_dur > f1; z0 > f1-new_dur
    */
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

  /** Convert pixel width to time duration */
	pixels2duration(p: number): number {
    if (!this.zoomRange) return 0;
		return p*(this.zoomRange[1]-this.zoomRange[0])/this.width;
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
   * Get timezone offset in hours
   */
  getTzOffset(): number {
    return this.tzOffset;
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

  updateTitle() {
    const tzFormatter = Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      signDisplay: 'always',
    });
    if (this.grid) {
      const title = `Time / UTC${tzFormatter.format(this.tzOffset)} / ${this.grid.interval}${this.grid.unit}`;
      // Could return or use this title for display in a header component
      return title;
    }
    return null;
  }

  /**
   * Render the time axis
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.grid || !this.fullRange || !this.zoomRange) {
      return;
    }

    // Draw background for axis area using bgAccent1
    const axisHeight = this.getHeight();
    ctx.fillStyle = colorToCSS(this.colorScheme.bgAccent1);
    ctx.fillRect(0, this.y, this.width, axisHeight);

    const G = this.grid;
    // Grid interval width
    const halfWidth = this.duration2pixels(G.minor) / 2;

    /* Find first grid line:
       offset + N*minor <= zoom_start
       N <= (zoom_start-offset)/minor
       floor(N) is closest int that meets condition */
    let n = Math.floor((this.zoomRange[0] - G.offset) / G.minor);

    // Iterate grid lines; buffer grid lines, draw labels immediately
    const minorPath = new Path2D();
    const majorPath = new Path2D();

    // Label font styling
    ctx.fillStyle = colorToCSS(this.colorScheme.foreground);
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Label start height
    const ly = this.y + 5;
    // Label format; for succinctness, only display relevant portion of full timestamp
    const lfmt = ({
      'μs': 'us',
      'ms': 'ms',
      's': 'time',
      'm': 'time',
      'h': 'time',
      'd': 'date',
      'M': 'date',
      'y': 'date',
    } as Record<string, 'date' | 'time' | 'ms' | 'us'>)[G.unit];
    let t = G.offset + n * G.minor;
    let i = 0;
    let last = false;

    while (true) {
      // Add 0.5 to get crisp 1px lines (avoids anti-aliasing across 2 pixels)
      const x = Math.floor(this.time2pixel(t)) + 0.5;
      const path = !(n % G.major) ? majorPath : minorPath;
      // Grid lines only extend through histogram area (0 to axis y position)
      path.moveTo(x, 0);
      path.lineTo(x, this.y);

      // Label
      const fmt = format_time(t);
      const label = fmt[lfmt];
      ctx.fillText(label, x + halfWidth, ly);

      // TODO: fix this
      if (++i > 100) {
        console.error('Too many iterations in grid rendering');
        return;
      }

      // Draw 1 extra to capture text straddling edge
      if (last) break;
      n++;
      t += G.minor;
      if (t >= this.zoomRange[1]) {
        last = true;
      }
    }

    // Draw grid lines
    ctx.lineWidth = 1;
    // Major grid lines: use bgAccent1 (most prominent - largest shift from background)
    ctx.strokeStyle = colorToCSS(this.colorScheme.bgAccent3);
    ctx.stroke(majorPath);
    // Minor grid lines: use bgAccent3 (most subtle - smallest shift from background)
    ctx.strokeStyle = colorToCSS(this.colorScheme.bgAccent1);
    ctx.stroke(minorPath);
  }
}
