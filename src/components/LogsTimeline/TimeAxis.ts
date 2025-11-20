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
  /** Minimum pixel width between grid intervals
   * TODO: make this dynamic based on what is being
   * displayed and font, e.g. 05:00 is shorter than 2025-10-12
   */
  minIntervalWidth: number;
  /** How much each zoom iteration should scale the current duration */
  zoomFactor: number;
  /** Scale from wheel scroll pixel coordinates to zoom iterations */
  zoomWheelScale: number;
  /** Maximum pixel width that for 1 microsecond */
  maxMicrosecondWidth: number;
  /* Define grid line spacings. They should be ordered from smallest to largest minWidth */
  spacings: Array<{
    /** Time unit */
    unit: string;
    /** Minimum duration in microseconds that is possible for this unit.
     * Used when deciding whether there is enough space to draw axis labels, and use this unit.
     */
    minDuration: number;
    /** Allowed multiples of unit to display as grid lines */
    intervals: number[];
  }>;
}

const DEFAULT_GRID_SETTINGS: GridSettings = {
  minIntervalWidth: 80,
  zoomFactor: 0.15,
  zoomWheelScale: 120,
  maxMicrosecondWidth: 100,
  spacings: [
    {
      unit: 'μs',
      minDuration: 1,
      intervals: [1, 2, 5, 15, 25, 50, 100, 250, 500]
    },
    {
      unit: 'ms',
      minDuration: 1000,
      intervals: [1, 2, 5, 10, 25, 50, 100, 250, 500]
    },
    {
      unit: 's',
      minDuration: 1000*1000,
      // typical wall clock divisions
      intervals: [1, 2, 5, 10, 15, 30]
    },
    {
      unit: 'm',
      minDuration: 60*1000*1000,
      // typical wall clock divisions
      intervals: [1, 2, 5, 10, 15, 30]
    },
    {
      unit: 'h',
      minDuration: 60*60*1000*1000,
      // 8 to match typical workday; 12 for sensible noon/midnight division
      intervals: [1, 2, 4, 8, 12]
    },
    {
      unit: 'd',
      // daylight savings; currently max shift for any timezone is 1hr
      minDuration: 23*60*60*1000*1000,
      // TODO: multiples of seven aligned to monday?
      intervals: [1, 2, 5, 10, 15]
    },
    {
      unit: 'M',
      // february
      minDuration: 28*24*60*60*1000*1000,
      // quartarly and mid-year divisions
      intervals: [1, 2, 4, 6]
    },
    {
      unit: 'y',
      // non-leap year
      minDuration: 365*24*60*60*1000*1000,
      intervals: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]
    },
  ],
};

/**
 * Represents a single grid line to be drawn
 */
interface GridLine {
  /** Is this a major grid line? */
  major: boolean;
  /** Microsecond timestamp */
  timeUs: number;
  /** Formatted label text, which should be rendered between this and the next grid line */
  label: string;
}

/**
 * Generates grid lines using calendar-aware boundary detection.
 * Handles all time units (μs through years) with proper calendar arithmetic.
 */
class GridLineGenerator {
  /** Grid configuration settings (min spacing, zoom factors, available units) */
  private gridSettings: GridSettings;

  /**
   * Preprocessed flat array of [duration, {unit, interval, majorUnit}] pairs,
   * sorted in ascending duration order. Used for binary search to find appropriate
   * grid spacing based on zoom level.
   */
  private durationLookup: Array<[number, { unit: string; interval: number; majorUnit: string }]>;

  /**
   * Map of unit names to their floor timestamps (most recent boundary at/before range end).
   * Used as starting points for finding grid boundaries. E.g., 'M' → start of current month.
   */
  private offsets: Record<string, number>;

  /** Timezone offset in hours (used for title display) */
  private tzOffset: number;

  /** Current minor unit for grid lines (e.g., 's', 'm', 'h', 'd', 'M', 'y') */
  private unit: string = '';

  /** Number of minor units between each grid line (e.g., 2 for "every 2 months") */
  private interval: number = 1;

  /** Major unit for emphasized grid lines (e.g., 'h' if unit is 'm') */
  private majorUnit: string = '';

  constructor(
    gridSettings: GridSettings,
    offsets: Record<string, number>,
    tzOffset: number
  ) {
    this.gridSettings = gridSettings;
    this.offsets = offsets;
    this.tzOffset = tzOffset;

    // Preprocess gridSettings into flat duration lookup array
    this.durationLookup = this.preprocessGridSettings(gridSettings);
  }

  /**
   * Preprocess gridSettings into a flat array of [duration, {unit, interval, majorUnit}] pairs.
   * Each entry represents minDuration * interval for a given spacing configuration.
   * Validates that the resulting array is in strictly ascending duration order.
   *
   * @param gridSettings - Grid configuration with spacings
   * @returns Sorted array of [duration, metadata] pairs for binary search
   * @throws Error if durations are not in ascending order
   */
  private preprocessGridSettings(
    gridSettings: GridSettings
  ): Array<[number, { unit: string; interval: number; majorUnit: string }]> {
    const result: Array<[number, { unit: string; interval: number; majorUnit: string }]> = [];

    // Flatten all spacings into [duration, metadata] pairs
    let prev = 0;
    for (let i = 0; i < gridSettings.spacings.length; i++) {
      const spacing = gridSettings.spacings[i];
      // Major unit is the next unit up in the hierarchy (or same if last)
      const majorUnit = gridSettings.spacings[i + 1]?.unit || spacing.unit;

      for (const interval of spacing.intervals) {
        const duration = spacing.minDuration * interval;
        // Validate ascending order
        if (duration <= prev) {
          throw new Error(`Grid setting unit=${spacing.unit} interval=${interval} is not in ascending order`);
        }
        result.push([duration, { unit: spacing.unit, interval, majorUnit }]);
      }
    }

    return result;
  }

  /**
   * Binary search to find the first duration >= target value.
   * Returns the metadata (unit, interval, majorUnit) for that duration.
   *
   * @param targetDuration - Minimum duration to search for (in microseconds)
   * @returns Metadata for the first duration >= targetDuration, or null if not found (which means
   * the target duration is incredibly large)
   */
  private findMinDuration(targetDuration: number): { unit: string; interval: number; majorUnit: string } | null {
    // Binary search for first element >= targetDuration
    let left = 0;
    let right = this.durationLookup.length - 1;
    let result: { unit: string; interval: number; majorUnit: string } | null = null;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const [duration, metadata] = this.durationLookup[mid];

      if (duration >= targetDuration) {
        result = metadata;
        right = mid - 1; // Continue searching left for smaller valid duration
      } else {
        left = mid + 1;
      }
    }

    return result;
  }

  /**
   * Update grid configuration based on zoom level.
   * Analyzes the visible time range and canvas width to determine the optimal
   * grid unit and interval that maintains minimum pixel spacing between labels.
   *
   * Sets internal state: unit (minor unit), interval (# of units per line), majorUnit
   *
   * @param zoomRangeUs Visible time range [start, end] in microseconds
   * @param width Canvas width in pixels
   */
  updateZoom(zoomRangeUs: [number, number], width: number): void {
    // Microseconds span for the full grid
    const us = zoomRangeUs[1] - zoomRangeUs[0];
    const usPerPx = us / width;
    // Minimum interval between grid lines in microsecond coordinates
    const minGridUs = usPerPx * this.gridSettings.minIntervalWidth;

    // Use binary search to find the smallest duration >= minGridUs
    const config = this.findMinDuration(minGridUs);
    if (!config) {
      throw Error("Max zoom duration clamping needs to be increased")
    }

    this.unit = config.unit;
    this.interval = config.interval;
    this.majorUnit = config.majorUnit;
  }

  /**
   * Generate grid lines for the visible range.
   * Yields GridLine records with timestamp, major/minor flag, and formatted label.
   *
   * Uses calendar arithmetic to place lines at actual unit boundaries (e.g., month starts),
   * not fixed microsecond intervals. Major lines fall on major unit boundaries.
   *
   * Example: If unit='m' (minutes), interval=15, majorUnit='h' (hour):
   *   - Yields lines at :00, :15, :30, :45 of each hour
   *   - Lines at :00 are marked major=true (hour boundary)
   *
   * @param zoomRangeUs - Visible time range [start, end] in microseconds
   * @yields GridLine objects with {major, timeUs, label}
   */
  *generate(zoomRangeUs: [number, number]): Generator<GridLine> {
    if (!this.unit) return;

    // Find first boundary at or before range start
    let timeUs = this.findFirstBoundary(zoomRangeUs[0]);
    let n = 0;
    let iterCount = 0;
    const maxIters = 1000; // Safety limit

    // Generate lines until past range end (+ extra for edge labels)
    while (timeUs <= zoomRangeUs[1] && iterCount++ < maxIters) {
      const isMajor = this.isMajorBoundary(timeUs);
      const label = this.formatLabel(timeUs);

      yield { major: isMajor, timeUs, label };

      // Increment to next boundary
      timeUs = this.incrementTime(timeUs, this.unit, this.interval);
      n++;
    }

    if (iterCount >= maxIters) {
      console.error('Too many iterations in grid line generation');
    }
  }

  /**
   * Find the first boundary of the current unit at or before startUs.
   * Starts from the major unit offset (e.g., start of current month) and walks
   * forward/backward to find the closest boundary.
   *
   * @param startUs - Start of zoom range in microseconds
   * @returns Timestamp in microseconds of the first grid line boundary
   */
  private findFirstBoundary(startUs: number): number {
    // Start from the offset for the major unit
    let timeUs = this.offsets[this.majorUnit] || 0;

    // Walk forward to the first boundary >= startUs
    while (timeUs < startUs) {
      timeUs = this.incrementTime(timeUs, this.unit, this.interval);
    }

    // Walk back one step if we overshot
    if (timeUs > startUs) {
      timeUs = this.decrementTime(timeUs, this.unit, this.interval);
    }

    return timeUs;
  }

  /**
   * Check if a timestamp is at a major unit boundary.
   * Major boundaries are used for emphasized grid lines (e.g., hour marks when showing minutes).
   *
   * @param timeUs - Timestamp in microseconds
   * @returns true if this timestamp is at a major unit boundary
   */
  private isMajorBoundary(timeUs: number): boolean {
    const timeMs = Math.floor(timeUs / 1000);
    const date = new Date(timeMs);

    switch (this.majorUnit) {
      case 'ms':
        return date.getMilliseconds() === 0;
      case 's':
        return date.getSeconds() === 0 && date.getMilliseconds() === 0;
      case 'm':
        return date.getMinutes() === 0 && date.getSeconds() === 0;
      case 'h':
        return date.getHours() === 0 && date.getMinutes() === 0;
      case 'd':
        return date.getHours() === 0 && date.getMinutes() === 0;
      case 'M':
        return date.getDate() === 1 && date.getHours() === 0;
      case 'y':
        return date.getMonth() === 0 && date.getDate() === 1;
      default:
        return false;
    }
  }

  /**
   * Increment time by calendar interval using Date arithmetic.
   * Handles variable-length periods correctly (e.g., months with 28-31 days, leap years).
   *
   * @param timeUs - Starting timestamp in microseconds
   * @param unit - Time unit ('μs', 'ms', 's', 'm', 'h', 'd', 'M', 'y')
   * @param interval - Number of units to increment (can be negative)
   * @returns New timestamp in microseconds
   */
  private incrementTime(timeUs: number, unit: string, interval: number): number {
    const timeMs = Math.floor(timeUs / 1000);
    const date = new Date(timeMs);
    const microPart = timeUs % 1000;

    switch (unit) {
      case 'μs':
        return timeUs + interval;
      case 'ms':
        date.setMilliseconds(date.getMilliseconds() + interval);
        break;
      case 's':
        date.setSeconds(date.getSeconds() + interval);
        break;
      case 'm':
        date.setMinutes(date.getMinutes() + interval);
        break;
      case 'h':
        date.setHours(date.getHours() + interval);
        break;
      case 'd':
        date.setDate(date.getDate() + interval);
        break;
      case 'M':
        date.setMonth(date.getMonth() + interval);
        break;
      case 'y':
        date.setFullYear(date.getFullYear() + interval);
        break;
    }

    return date.getTime() * 1000 + microPart;
  }

  /**
   * Decrement time by calendar interval using Date arithmetic.
   *
   * @param timeUs - Starting timestamp in microseconds
   * @param unit - Time unit
   * @param interval - Number of units to decrement
   * @returns New timestamp in microseconds
   */
  private decrementTime(timeUs: number, unit: string, interval: number): number {
    return this.incrementTime(timeUs, unit, -interval);
  }

  /**
   * Format label based on unit.
   * Returns appropriate portion of timestamp (date, time, ms, or us) depending on unit.
   *
   * @param timeUs - Timestamp in microseconds
   * @returns Formatted label string
   */
  private formatLabel(timeUs: number): string {
    const fmt = format_time(timeUs);

    // Determine label format based on unit
    const lfmt = ({
      μs: 'us',
      ms: 'ms',
      s: 'time',
      m: 'time',
      h: 'time',
      d: 'date',
      M: 'date',
      y: 'date',
    } as Record<string, 'date' | 'time' | 'ms' | 'us'>)[this.unit];

    return fmt[lfmt] || '';
  }

  /**
   * Get title string showing current grid configuration.
   * Format: "Time / UTC±X.XX / <interval><unit>"
   * Example: "Time / UTC-8.00 / 15m" (15 minute intervals, UTC-8 timezone)
   *
   * @returns Formatted title string for display
   */
  getTitle(): string {
    const tzFormatter = Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      signDisplay: 'always',
    });
    return `Time / UTC${tzFormatter.format(this.tzOffset)} / ${this.interval}${this.unit}`;
  }
}

export class TimeAxis {
  private chart: any;
  private width: number = 0;
  private fullRange: [number, number] | null = null;
  private zoomRange: [number, number] | null = null;
  private gridLineGenerator: GridLineGenerator | null = null;
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

    // Create grid line generator with updated offsets
    this.gridLineGenerator = new GridLineGenerator(this.gridSettings, this.offsets, this.tzOffset);

    // Update grid configuration for current zoom
    if (this.zoomRange && this.width) {
      this.gridLineGenerator.updateZoom(this.zoomRange, this.width);
    }
  }

  updateWidth(width: number): void {
    this.width = width;

    // Update grid configuration for new width
    if (this.gridLineGenerator && this.zoomRange) {
      this.gridLineGenerator.updateZoom(this.zoomRange, width);
    }
  }

  /**
   * Shift the timeline forward/backward. Zoom duration remains unchanged, so the grid doesn't
   * need to be recalculated.
   * @param id Drag identifier, for determining if a new drag has started; use null to force it
   * to interpret as a new drag
   * @param startX Starting position of drag
   * @param endX Current/ending position of drag
   */
  mousedrag(id: number | null, startX: number, endX: number): boolean {
    if (!this.zoomRange || !this.fullRange) return false;

    // New drag; mark starting time to be the fixed reference for drag
    let d = this.dragData;
    if (d?.id !== id) {
      d = this.dragData = {
        // convert null to -1, which forces null to always restart
        id: id || -1,
        center: this.pixel2time(startX),
      };
    }

    // Shift d.center to match current mouse position
    const shift = d.center - this.pixel2time(endX);
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
   * @param factor Zooming delta in pixel coordinates
   * @param centerX Mouse coordinate to center the zoom on
   */
  zoom(factor: number, centerX: number): boolean {
    if (!this.zoomRange || !this.fullRange) return false;
    const G = this.gridSettings;

    // How many zoom scaling iterations to perform
    const iters = Math.abs(factor / G.zoomWheelScale);
    // Scaling factor per iteration
    const base = 1 + Math.sign(factor) * G.zoomFactor;
    // Repeated scale = exponent
    const zoom = Math.pow(base, iters);
    // We want to keep the timestamp the mouse is sitting on in the same position. This means we
    // want its time to remain the same proportion/percentage along the duration before and after
    // scaling duration.
    const zoomDur = this.zoomRange[1] - this.zoomRange[0];
    const ctrTime = this.pixel2time(centerX);
    const ctrProp = (ctrTime - this.zoomRange[0]) / zoomDur;
    // New duration, with max zoom limits applied
    const newDur = Math.max(this.width / G.maxMicrosecondWidth, zoomDur * zoom);
    /* Calculate shift to keep mouse timestamp at the same proportion along duration:
        new_dur*ctr_prop + z0 = ctr_time
      Could implement clamping on this line, but we don't clamp currently
      clamping:
				[ [-----x--]--] z0 < f0
				[--[----x--]  ] z0+new_dur > f1; z0 > f1-new_dur
    */
    const z0 = ctrTime - newDur * ctrProp;
    this.zoomRange = [z0, z0 + newDur];

    // Update grid configuration for new zoom level
    if (this.gridLineGenerator) {
      this.gridLineGenerator.updateZoom(this.zoomRange, this.width);
    }
    this.chart.render();

    // Cancel propagation
    return true;
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
    if (this.fullRange && this.gridLineGenerator) {
      this.zoomRange = [...this.fullRange];

      // Update grid configuration for full range
      this.gridLineGenerator.updateZoom(this.zoomRange, this.width);

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
    if (this.gridLineGenerator) {
      return this.gridLineGenerator.getTitle();
    }
    return null;
  }

  /**
   * Render the time axis
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.gridLineGenerator || !this.fullRange || !this.zoomRange) {
      return;
    }

    // Draw background for axis area using bgAccent1
    const axisHeight = this.getHeight();
    ctx.fillStyle = colorToCSS(this.colorScheme.bgAccent1);
    ctx.fillRect(0, this.y, this.width, axisHeight);

    // Prepare drawing paths
    const minorPath = new Path2D();
    const majorPath = new Path2D();

    // Label font styling
    ctx.fillStyle = colorToCSS(this.colorScheme.foreground);
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Label start height
    const ly = this.y + 5;

    // Generate and draw grid lines
    for (const gridLine of this.gridLineGenerator.generate(this.zoomRange)) {
      // Add 0.5 to get crisp 1px lines (avoids anti-aliasing across 2 pixels)
      const x = Math.floor(this.time2pixel(gridLine.timeUs)) + 0.5;
      const path = gridLine.major ? majorPath : minorPath;

      // Grid lines only extend through histogram area (0 to axis y position)
      path.moveTo(x, 0);
      path.lineTo(x, this.y);

      // Draw label centered on grid line
      ctx.fillText(gridLine.label, x, ly);
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
