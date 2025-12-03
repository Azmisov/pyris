/**
 * Time axis for the timeline chart
 * Handles conversion between time and pixel coordinates, zoom, and rendering
 */
import { dateTimeParse, dateTimeAsMoment } from '@grafana/data';
import { Moment, unitOfTime } from 'moment';
import { ColorScheme } from '../../theme/colorSchemes';

// Helper to convert AnsiColor to CSS color
function colorToCSS(color: { r: number; g: number; b: number }): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/** Pad number with N digits */
export function pad(num: number, digits: number): string {
	return String(num).padStart(digits, '0');
}

/** Given millisecond time since 1970 epoch, output string parts */
function format_time(t: number) : { date: string, time: string, ms: string } {
	const d = new Date(t);
	return {
		date: `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`,
		time: `${pad(d.getHours(),2)}:${pad(d.getMinutes(),2)}:${pad(d.getSeconds(),2)}`,
		ms: pad(d.getMilliseconds(), 3),
	};
}

/** Same as format_time, but not as parts */
export function format_time_full(t: number) : string {
	const parts = format_time(t);
	return `${parts.date} ${parts.time}.${parts.ms}`;
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
  /** Maximum pixel width that for 1 millisecond */
  maxMillisecondWidth: number;
  /* Define grid line spacings. They should be ordered from smallest to largest minWidth */
  spacings: Array<{
    /** Time unit */
    unit: string;
    /** Minimum duration in milliseconds that is possible for this unit.
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
  maxMillisecondWidth: 100,
  spacings: [
    // TODO: Grafana dateTime handling is millisecond level, so we'd need to do special handling
    // if we want to support micro/nanosecond resolution
    // {
    //   unit: 'μs',
    //   minDuration: 1,
    //   intervals: [500, 250, 100, 50, 25, 15, 5, 2, 1]
    // },
    {
      unit: 'ms',
      minDuration: 1,
      intervals: [500, 250, 100, 50, 25, 10, 5, 2, 1]
    },
    {
      unit: 's',
      minDuration: 1000,
      // typical wall clock divisions
      intervals: [30, 15, 10, 5, 2, 1]
    },
    {
      unit: 'm',
      minDuration: 60*1000,
      // typical wall clock divisions
      intervals: [30, 15, 10, 5, 2, 1]
    },
    {
      unit: 'h',
      minDuration: 60*60*1000,
      // 8 to match typical workday; 12 for sensible noon/midnight division
      intervals: [12, 8, 4, 2, 1]
    },
    {
      unit: 'd',
      // daylight savings; currently max shift for any timezone is 1hr
      minDuration: 23*60*60*1000,
      // TODO: multiples of seven aligned to monday?
      intervals: [15, 10, 5, 2, 1]
    },
    {
      unit: 'M',
      // february
      minDuration: 28*24*60*60*1000,
      // quartarly and mid-year divisions
      intervals: [6, 4, 2, 1]
    },
    {
      unit: 'y',
      // non-leap year
      minDuration: 365*24*60*60*1000,
      intervals: [1000, 500, 250, 100, 50, 25, 10, 5, 2, 1]
    },
  ],
};

/**
 * Represents a single grid line to be drawn
 */
interface GridLine {
  /** Is this a major grid line? */
  major: boolean;
  /** TZ aware timestamp */
  time: Moment;
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

  /** Timezone offset in hours (used for title display) */
  private tzOffset: number;

  /** Current minor unit for grid lines (e.g., 's', 'm', 'h', 'd', 'M', 'y') */
  private unit: string = '';

  /** Major unit for emphasized grid lines (e.g., 'h' if unit is 'm') */
  private majorUnit: string = '';

  /** Number of minor units between each grid line (e.g., 2 for "every 2 months") */
  private interval: number = 1;

  constructor(
    gridSettings: GridSettings,
    tzOffset: number
  ) {
    this.gridSettings = gridSettings;
    this.tzOffset = tzOffset;
  }

  /**
   * Update grid configuration based on zoom level.
   * Analyzes the visible time range and canvas width to determine the optimal
   * grid unit and interval that maintains minimum pixel spacing between labels.
   *
   * Sets internal state: unit (minor unit), interval (# of units per line), majorUnit
   *
   * @param zoomRangeMs Visible time range [start, end] in milliseconds
   * @param width Canvas width in pixels
   */
  updateZoom(zoomRangeMs: [number, number], width: number): void {
    // Milliseconds span for the full grid
    const ms = zoomRangeMs[1] - zoomRangeMs[0];
    const msPerPx = ms / width;
    // Minimum interval between grid lines in millisecond coordinates
    // TODO: eventually this will be dynamic per unit
    const minGridMs = msPerPx * this.gridSettings.minIntervalWidth;

    // We iterate in order since min grid spacing is dynamic based on how unit is formatted. Which
    // means the spacing may go up or down so ordering not guaranteed. So need to iterate from min
    // linearly to find the minimum possible unit
    const spacings = this.gridSettings.spacings
    for (let si=0; si<spacings.length; si++) {
      const spacing = spacings[si];
      // Check the largest interval first to see if it meets minimum. If it does, we can refine
      // and check other smaller intervals
      let best = -1;
      for (; best < spacing.intervals.length - 1; best++) {
        // Compute grid spacing in milliseconds for this unit + interval
        const nextInterval = spacing.intervals[best+1];
        const gridMs = nextInterval*spacing.minDuration;
        // Stop once we see an interval that's too small
        if (gridMs < minGridMs) {
          break;
        }
      }

      // No interval for this unit is sufficient, try next unit
      if (best == -1) {
        continue
      }

      // Found sufficient unit + interval
      this.unit = spacing.unit;
      this.majorUnit = spacings[si+1]?.unit || spacing.unit;
      this.interval = spacing.intervals[best];
      return;
    }

    throw Error("Max zoom duration clamping needs to be increased")
  }

  /**
   * Generate grid lines for the visible range.
   * Yields GridLine records with timestamp, major/minor flag, and formatted label.
   *
   * Uses calendar arithmetic to place lines at actual unit boundaries (e.g., month starts),
   * not fixed millisecond intervals. Major lines fall on major unit boundaries.
   *
   * Example: If unit='m' (minutes), interval=15, majorUnit='h' (hour):
   *   - Yields lines at :00, :15, :30, :45 of each hour
   *   - Lines at :00 are marked major=true (hour boundary)
   *
   * @param zoomRangeMs - Visible time range [start, end] in milliseconds
   * @yields GridLine objects with {major, time, label}
   */
  *generate(zoomRangeMs: [number, number]): Generator<GridLine> {
    if (!this.unit) return;

    const unit = this.unit as unitOfTime.Base;
    const majorUnit = this.majorUnit as unitOfTime.Base;

    // Start out using the grafana datetime wrapper just to handle possibly grafana-specific
    // timezones, then switch to moment object since the grafana wrapper lacks the methods we need.
    let cursor = dateTimeAsMoment(dateTimeParse(zoomRangeMs[0], { timeZone: "America/Boise" }));
    // Initial goal is to find the minor grid interval which 1) <= start 2) multiple of interval in
    // wall clock time (not physical UTC time). First truncate to meet condition #1.
    cursor = cursor.startOf(unit);
    // Iterate backwards for condition #2. Subtraction occurs in physical/UTC time, but our
    // condition is based on wall clock / tz-aware time. So where we get DST jumps, we may need
    // multiple passes to find a time that lies on the correct interval. Okay if we overshoot and
    // don't get the minor grid which is closest to start, as we'll clip those as we iterate.
    while (true) {
      const remainder = cursor.get(unit) % this.interval;
      if (remainder === 0){
        break;
      }
      cursor = cursor.subtract(remainder, unit);
    }

    // We want the first interval <= start up until the last interval < end. To clip at the start,
    // we check that the current and subsequent grid lines aren't both before start.
    let clippedBefore = cursor.valueOf() < zoomRangeMs[0];

    // Major units we generate separately. Most units we chose intervals that will always line up
    // evenly with a major unit, e.g. 15min intervals line up on 60min for an hour. But others don't,
    // like 12hrs fails with daylight savings when there's 25hrs. Or we might want monday-aligned
    // 7 day intervals for month. So we track the next major unit and whenever it is passed, we
    // force a major grid line to be generated.
    let nextMajor = cursor.clone().startOf(majorUnit);
    let isMajor = cursor.isSame(nextMajor);
    nextMajor = nextMajor.add(1, majorUnit);

    while (cursor.valueOf() < zoomRangeMs[1]) {
      // Calculate next interval. We do this first since it helps us identify start clipping,
      // and we would need to compute next cursor anyways.
      let nextCursor = cursor.clone().add(this.interval, unit);

      // For DST shift the wall clock interval could be off: greater if wall clocks jumped ahead,
      // less if they jumped behind. If greater, then the current interval is unavailable because
      // there's a gap due to the time skip; so we need to skip to the next interval. If less, then
      // the current interval is available, just ahead by some amount.
      const remainder = nextCursor.get(unit) % this.interval;
      if (remainder !== 0) {
        nextCursor = nextCursor.add(this.interval - remainder, unit);
      }

      // If >= next major interval, clamp to major
      let nextIsMajor = nextCursor.isSameOrAfter(nextMajor);
      if (nextIsMajor) {
        nextCursor = nextMajor;
        nextMajor = nextMajor.clone().add(1, majorUnit);
      }

      // Start clipping
      if (clippedBefore) {
        clippedBefore = nextCursor.valueOf() < zoomRangeMs[0];
      }

      // Not clipped, okay to yield current cursor
      if (!clippedBefore) {
        yield {time: cursor, major: isMajor, label: this.formatLabel(cursor.valueOf())};
      }

      cursor = nextCursor;
      isMajor = nextIsMajor;
    }
  }

  /**
   * Format label based on unit.
   * Returns appropriate portion of timestamp (date, time, or ms) depending on unit.
   *
   * @param timeMs - Timestamp in milliseconds
   * @returns Formatted label string
   */
  private formatLabel(timeMs: number): string {
    const fmt = format_time(timeMs);

    // Determine label format based on unit
    const lfmt = ({
      ms: 'ms',
      s: 'time',
      m: 'time',
      h: 'time',
      d: 'date',
      M: 'date',
      y: 'date',
    } as Record<string, 'date' | 'time' | 'ms'>)[this.unit];

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

    // Calculate timezone offset from end time (closer to current wall clock offset)
    const endMs = timeRange[1];
    const date = new Date(endMs);
    this.tzOffset = -date.getTimezoneOffset() / 60;

    // Create grid line generator
    this.gridLineGenerator = new GridLineGenerator(this.gridSettings, this.tzOffset);

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
  shift(id: number | null, startX: number, endX: number): boolean {
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
    const newDur = Math.max(this.width / G.maxMillisecondWidth, zoomDur * zoom);
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
      const x = Math.floor(this.time2pixel(gridLine.time.valueOf())) + 0.5;
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
