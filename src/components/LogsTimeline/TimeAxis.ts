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

/** Get the unit component as a 0-indexed value for alignment calculations.
 * - Maps 'd' → 'D' (moment.get('d') = day of week, 'D' = day of month)
 * - Converts days from 1-indexed (1-31) to 0-indexed for alignment
 */
function getAlignedUnitValue(cursor: Moment, unit: string): number {
  // 'd' for add/subtract = days, but get('d') = day of week; get('D') = day of month
  const getterUnit = (unit === 'd' ? 'D' : unit) as unitOfTime.All;
  const value = cursor.get(getterUnit);
  // Days are 1-indexed (1-31), convert to 0-indexed for alignment
  return unit === 'd' ? value - 1 : value;
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
  /** Margin between labels in pixels (added to calculated label width) */
  labelMargin: number;
  /** How much each zoom iteration should scale the current duration */
  zoomFactor: number;
  /** Scale from wheel scroll pixel coordinates to zoom iterations */
  zoomWheelScale: number;
  /** Maximum pixel width for 1 millisecond (limits zoom in) */
  maxMillisecondWidth: number;
  /** Maximum duration in milliseconds (limits zoom out) */
  maxDuration: number;
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
    /** Format the grid value */
    format: (d: Moment) => string;
  }>;
}

const DEFAULT_GRID_SETTINGS: GridSettings = {
  labelMargin: 16,
  zoomFactor: 0.15,
  zoomWheelScale: 120,
  maxMillisecondWidth: 100,
  maxDuration: 50 * 365 * 24 * 60 * 60 * 1000, // 50 years
  spacings: [
    // TODO: Grafana dateTime handling is millisecond level, so we'd need to do special handling
    // if we want to support micro/nanosecond resolution
    {
      unit: 'ms',
      minDuration: 1,
      intervals: [500, 250, 100, 50, 25, 10, 5, 2, 1],
      // alternatives: 50ms, 50, .050
      format: d => d.format("SSS")
    },
    {
      unit: 's',
      minDuration: 1000,
      // typical wall clock divisions
      intervals: [30, 15, 10, 5, 2, 1],
      // alternatives: 09s,, 12:30:59, :30:59
      format: d => d.format("s[s]")
    },
    {
      unit: 'm',
      minDuration: 60*1000,
      // typical wall clock divisions
      intervals: [30, 15, 10, 5, 2, 1],
      // alternatives: :30
      format: d => d.format("HH:mm")
    },
    {
      unit: 'h',
      minDuration: 60*60*1000,
      // 8 to match typical workday; 12 for sensible noon/midnight division
      intervals: [12, 8, 4, 2, 1],
      // alternatives: 12h, 12:
      format: d => d.format("HH:mm")
    },
    {
      unit: 'd',
      // daylight savings; currently max shift for any timezone is 1hr
      minDuration: 23*60*60*1000,
      // TODO: multiples of seven aligned to monday? I think if we do this we'd need to change
      // labels to be day of week, otherwise it just looks nonsensical and buggy
      intervals: [15, 10, 5, 2, 1],
      // alternatives: 2025-01-03, 01-03, 1-3, 1/3
      format: d => d.format("Do")
    },
    {
      unit: 'M',
      // february
      minDuration: 28*24*60*60*1000,
      // quartarly and mid-year divisions
      intervals: [6, 3, 2, 1],
      // alternative: 2025-01, 2025/1
      format: d => d.format("MMM")
    },
    {
      unit: 'y',
      // non-leap year
      minDuration: 365*24*60*60*1000,
      intervals: [1000, 500, 250, 100, 50, 25, 10, 5, 2, 1],
      format: d => d.format("YYYY")
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

  /** Index into spacings array for current unit (used for walking up to find max aligned unit) */
  private spacingIndex: number = 0;

  /** Format function for the current (minor) unit */
  private format: (d: Moment) => string = () => '';

  /** Calculated minimum interval width based on font metrics */
  private minIntervalWidth: number = 80;

  /** Minimum grid spacing in milliseconds (computed from minIntervalWidth and current zoom) */
  private minGridMs: number = 0;

  /** Font family used for label width calculation (for cache invalidation) */
  private fontFamily: string = '';

  /** Font size used for labels */
  private fontSize: number = 12;

  /** Timezone string for date parsing */
  private timeZone: string = 'browser';

  constructor(
    gridSettings: GridSettings,
    tzOffset: number,
    timeZone: string = 'browser'
  ) {
    this.gridSettings = gridSettings;
    this.tzOffset = tzOffset;
    this.timeZone = timeZone;
  }

  /**
   * Calculate the minimum interval width based on the widest possible label.
   * Uses a sample timestamp (9999-12-31T23:59:59.999) to get max-width formatted strings.
   * Measures in bold since major labels are bold.
   */
  updateLabelMetrics(fontFamily: string, fontSize: number): void {
    // Skip if font hasn't changed
    if (this.fontFamily === fontFamily && this.fontSize === fontSize) {
      return;
    }
    this.fontFamily = fontFamily;
    this.fontSize = fontSize;

    // Create offscreen canvas for text measurement
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.minIntervalWidth = 80; // Fallback
      return;
    }

    // Use bold font since major labels are bold (widest case)
    ctx.font = `bold ${fontSize}px ${fontFamily}`;

    // Sample timestamp with wide digits (9s are typically widest)
    const sampleTime = dateTimeAsMoment(dateTimeParse('9999-12-31T23:59:59.999Z'));

    // Measure width of each spacing's formatted output
    let maxWidth = 0;
    for (const spacing of this.gridSettings.spacings) {
      const label = spacing.format(sampleTime);
      const width = ctx.measureText(label).width;
      if (width > maxWidth) {
        maxWidth = width;
      }
    }

    // Add margin for spacing between labels
    this.minIntervalWidth = Math.ceil(maxWidth) + this.gridSettings.labelMargin;
  }

  /**
   * Find the highest time unit that the given timestamp aligns with.
   * Walks up from the current minor unit through all larger units.
   * Returns the format function for that unit.
   *
   * Example: 00:00 on Jan 1st aligns with minute, hour, day, month, AND year.
   * Returns the year formatter since that's the highest aligned unit.
   */
  private findHighestAlignedFormat(cursor: Moment): (d: Moment) => string {
    const spacings = this.gridSettings.spacings;
    let highestFormat = this.format;

    // Walk up through all units larger than current
    for (let i = this.spacingIndex + 1; i < spacings.length; i++) {
      const spacing = spacings[i];
      const unitStart = cursor.clone().startOf(spacing.unit as unitOfTime.StartOf);
      if (cursor.isSame(unitStart)) {
        // Timestamp aligns with this larger unit, use its formatter
        highestFormat = spacing.format;
      } else {
        // Doesn't align with this unit, won't align with any larger units either
        break;
      }
    }

    return highestFormat;
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
    this.minGridMs = msPerPx * this.minIntervalWidth;

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
        if (gridMs < this.minGridMs) {
          break;
        }
      }

      // No interval for this unit is sufficient, try next unit
      if (best == -1) {
        continue
      }

      // Found sufficient unit + interval
      this.unit = spacing.unit;
      this.format = spacing.format;
      this.spacingIndex = si;
      // Major unit is the next larger unit; empty string if none (e.g., years have no major)
      const majorSpacing = spacings[si+1];
      this.majorUnit = majorSpacing?.unit || '';
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
    let cursor = dateTimeAsMoment(dateTimeParse(zoomRangeMs[0], { timeZone: this.timeZone }));
    // Initial goal is to find the minor grid interval which 1) <= start 2) multiple of interval in
    // wall clock time (not physical UTC time). First truncate to meet condition #1.
    cursor = cursor.startOf(unit);
    // Iterate backwards for condition #2. Subtraction occurs in physical/UTC time, but our
    // condition is based on wall clock / tz-aware time. So where we get DST jumps, we may need
    // multiple passes to find a time that lies on the correct interval. Okay if we overshoot and
    // don't get the minor grid which is closest to start, as we'll clip those as we iterate.
    while (true) {
      const remainder = getAlignedUnitValue(cursor, unit) % this.interval;
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
    // Note: majorUnit may be empty (e.g., for years) - in that case, no major lines are drawn.
    let nextMajor: Moment | null = null;
    let isMajor = false;
    if (majorUnit) {
      nextMajor = cursor.clone().startOf(majorUnit);
      isMajor = cursor.isSame(nextMajor);
      nextMajor = nextMajor.add(1, majorUnit);
    }

    while (cursor.valueOf() < zoomRangeMs[1]) {
      // Calculate next interval. We do this first since it helps us identify start clipping,
      // and we would need to compute next cursor anyways.
      let nextCursor = cursor.clone().add(this.interval, unit);

      // For DST shifts, wall clock may not align with our interval:
      // - Spring forward: add() overshoots (e.g., 00:00 + 4h = 05:00 instead of 04:00)
      //   → Try going BACK to the aligned time (04:00 exists, we just overshot it)
      // - Fall back: add() may land on repeated hour with wrong alignment
      //   → Go FORWARD to next aligned time
      const remainder = getAlignedUnitValue(nextCursor, unit) % this.interval;
      if (remainder !== 0) {
        // First try going back - this handles spring forward overshoot
        const backCursor = nextCursor.clone().subtract(remainder, unit);
        const backRemainder = getAlignedUnitValue(backCursor, unit) % this.interval;
        // Verify backCursor is actually aligned (DST fall back can cause subtract to land on wrong hour)
        if (backRemainder === 0 && backCursor.isAfter(cursor)) {
          nextCursor = backCursor;
        } else {
          // Go forward to next aligned time
          nextCursor = nextCursor.add(this.interval - remainder, unit);
        }
      }

      // If >= next major interval, clamp to major (skip if no major unit)
      let nextIsMajor = false;
      if (nextMajor && nextCursor.isSameOrAfter(nextMajor)) {
        nextIsMajor = true;
        nextCursor = nextMajor;
        nextMajor = nextMajor.clone().add(1, majorUnit);
      }

      // Start clipping
      if (clippedBefore) {
        clippedBefore = nextCursor.valueOf() < zoomRangeMs[0];
      }

      // Not clipped, okay to yield current cursor
      if (!clippedBefore) {
        // For major grid lines, find the highest unit this timestamp aligns with
        // For minor grid lines too close to the next major, use empty label to avoid overlap
        let label: string;
        if (isMajor) {
          label = this.findHighestAlignedFormat(cursor)(cursor);
        } else if (nextIsMajor && (nextCursor.valueOf() - cursor.valueOf()) < this.minGridMs) {
          // Minor label would overlap with upcoming major label, skip it
          label = '';
        } else {
          label = this.format(cursor);
        }
        yield {time: cursor, major: isMajor, label};
      }

      cursor = nextCursor;
      isMajor = nextIsMajor;
    }
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

const DEFAULT_FONT_FAMILY = 'JetBrains Mono, Cascadia Mono, DejaVu Sans Mono, Consolas, Courier New, monospace';
const LABEL_FONT_SIZE = 12;

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
  private fontFamily: string;
  /** Timezone string (e.g., "browser", "utc", or IANA timezone like "America/New_York") */
  private timeZone: string;
  public y: number = 0;

  constructor(chart: any, colorScheme: ColorScheme, fontFamily?: string, gridSettings?: Partial<GridSettings>, timeZone?: string) {
    this.chart = chart;
    this.colorScheme = colorScheme;
    this.fontFamily = fontFamily || DEFAULT_FONT_FAMILY;
    this.gridSettings = { ...DEFAULT_GRID_SETTINGS, ...gridSettings };
    this.timeZone = timeZone || 'browser';
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
    this.gridLineGenerator = new GridLineGenerator(this.gridSettings, this.tzOffset, this.timeZone);
    this.gridLineGenerator.updateLabelMetrics(this.fontFamily, LABEL_FONT_SIZE);

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
        id: id ?? -1,
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
    // New duration, with zoom limits applied (min: maxMillisecondWidth, max: maxDuration)
    const newDur = Math.min(G.maxDuration, Math.max(this.width / G.maxMillisecondWidth, zoomDur * zoom));
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
   * Update the font family for axis labels
   */
  setFontFamily(fontFamily: string): void {
    this.fontFamily = fontFamily;
    // Recalculate label metrics for new font
    if (this.gridLineGenerator) {
      this.gridLineGenerator.updateLabelMetrics(fontFamily, LABEL_FONT_SIZE);
    }
  }

  /**
   * Get height of the axis
   */
  getHeight(): number {
    return 19;
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const minorFont = `${LABEL_FONT_SIZE}px ${this.fontFamily}`;
    const majorFont = `bold ${LABEL_FONT_SIZE}px ${this.fontFamily}`;

    // Label y position - center vertically within axis height, round for crisp text
    const topPadding = Math.round((axisHeight - LABEL_FONT_SIZE) / 2);
    const ly = Math.round(this.y + topPadding);

    // Generate and draw grid lines
    for (const gridLine of this.gridLineGenerator.generate(this.zoomRange)) {
      const rawX = this.time2pixel(gridLine.time.valueOf());
      // For grid lines: +0.5 offset for crisp 1px strokes
      const lineX = Math.floor(rawX) + 0.5;
      // For text: round to integer pixel for crisp rendering
      const textX = Math.round(rawX);

      const path = gridLine.major ? majorPath : minorPath;

      // Grid lines only extend through histogram area (0 to axis y position)
      path.moveTo(lineX, 0);
      path.lineTo(lineX, this.y);

      // Draw label centered on grid line (bold for major)
      ctx.font = gridLine.major ? majorFont : minorFont;
      ctx.fillText(gridLine.label, textX, ly);
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
