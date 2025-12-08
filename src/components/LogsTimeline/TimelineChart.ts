/**
 * Timeline chart class
 * Manages canvas rendering, mouse events, and coordinate transformations
 */

import { TimeAxis } from './TimeAxis';
import { ColorScheme, colorToCSS } from '../../theme/colorSchemes';
import { VerticalIndicator, IndicatorFactory } from './VerticalIndicator';
import { LogCountIndex, HistogramBin } from './LogCountIndex';

/** Tooltip data passed to the callback */
export interface TooltipData {
  x: number;
  y: number;
  timestamp: number;
  /** Indicators at the snapped position */
  indicators: VerticalIndicator[];
  /** Histogram bin containing this timestamp, if any */
  bin: HistogramBin | null;
  /** True if timestamp is outside the full log data range */
  beyondLogs: boolean;
  /** True if timestamp is outside the visible logs range */
  beyondVisible: boolean;
  /** True if timestamp is outside the dashboard time range */
  beyondDashboard: boolean;
}

/** Range info data showing log counts outside visible range */
export interface RangeInfo {
  /** Number of logs before the visible range */
  before: number;
  /** Number of logs after the visible range */
  after: number;
}

const DRAG_THRESHOLD = 3;
const SNAP_THRESHOLD = 16; // Pixels within which hover snaps to indicators
const GRID_SNAP_THRESHOLD = 8; // Pixels within which hover snaps to grid lines

// Histogram binning configuration
const TARGET_PIXELS_PER_BIN = 15; // Target pixels per bin for histogram visibility

export class TimelineChart {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private observer: ResizeObserver;
  public axis: TimeAxis;
  private logCountIndex: LogCountIndex | null = null;
  private fullTimeRange: [number, number] | null = null;
  // Logical dimensions (CSS pixels, not scaled)
  private logicalWidth: number = 0;
  private logicalHeight: number = 0;
  private grayPattern: CanvasPattern | null = null;
  private hoverIndicator: VerticalIndicator | null = null;
  private selectedIndicator: VerticalIndicator | null = null;
  private rangeStartIndicator: VerticalIndicator | null = null;
  private rangeEndIndicator: VerticalIndicator | null = null;
  private dashboardStartIndicator: VerticalIndicator | null = null;
  private dashboardEndIndicator: VerticalIndicator | null = null;
  private colorScheme: ColorScheme;
  // Track ranges for beyondVisible/beyondDashboard checks
  private visibleRange: [number, number] | null = null;
  private dashboardRange: [number, number] | null = null;

  // Mouse state
  /** Autoincrementing drag identifier to indicate for knowing when a new drag has begun */
  private dragId: number = 0;
  private dragStart: [number, number] | null = null;
  private dragging: boolean = false;
  private pointerCapture: number | null = null;
  private mouseX: number | null = null;

  // Callback for log selection
  private onLogSelect?: (timestamp: number) => void;

  // Callback for tooltip updates
  private onTooltip?: (data: TooltipData | null) => void;

  // Callback for range info updates
  private onRangeInfo?: (info: RangeInfo | null) => void;

  // Event handlers (bound methods)
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundPointerLeave: (e: PointerEvent) => void;

  constructor(container: HTMLDivElement, colorScheme: ColorScheme, fontFamily?: string, timeZone?: string) {
    this.container = container;
    this.colorScheme = colorScheme;
    this.canvas = document.createElement('canvas');
    // Apply CSS text rendering optimization for geometric accuracy
    this.canvas.style.textRendering = 'geometricPrecision';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    this.ctx = ctx;
    // Disable image smoothing for crisp rendering
    this.ctx.imageSmoothingEnabled = false;

    this.axis = new TimeAxis(this, colorScheme, fontFamily, undefined, timeZone);

    // Create dotted pattern for grayed-out areas
    this.grayPattern = this.createDottedPattern();

    // Bind canvas dimensions to rendered size
    this.observer = new ResizeObserver((entries) => {
      const current = entries.at(-1)?.contentBoxSize[0];
      if (current) {
        this.updateDims(Math.floor(current.inlineSize), Math.floor(current.blockSize));
      }
    });
    this.observer.observe(container);

    // Bind event handlers
    this.boundPointerDown = this.pointerDown.bind(this);
    this.boundPointerUp = this.pointerUp.bind(this);
    this.boundPointerMove = this.pointerMove.bind(this);
    this.boundWheel = this.wheel.bind(this);
    this.boundPointerLeave = this.pointerLeave.bind(this);

    // Add event listeners
    container.addEventListener('pointerdown', this.boundPointerDown);
    container.addEventListener('pointerup', this.boundPointerUp);
    container.addEventListener('pointermove', this.boundPointerMove);
    container.addEventListener('wheel', this.boundWheel);
    container.addEventListener('pointerleave', this.boundPointerLeave);
  }

  /**
   * Create a dotted pattern for the grayed-out areas
   */
  private createDottedPattern(): CanvasPattern | null {
    // Create a small canvas for the pattern
    const patternCanvas = document.createElement('canvas');
    const patternSize = 8;
    patternCanvas.width = patternSize;
    patternCanvas.height = patternSize;

    const pctx = patternCanvas.getContext('2d');
    if (!pctx) return null;

    // Use bgAccent1 for subtle background
    const bgColor = this.colorScheme.bgAccent1;
    const bgRgb = `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, .2)`;
    pctx.fillStyle = bgRgb;
    pctx.fillRect(0, 0, patternSize, patternSize);

    // Use bgAccent2 for dots
    const dotColor = this.colorScheme.bgAccent2;
    const dotRgb = `rgba(${dotColor.r}, ${dotColor.g}, ${dotColor.b}, .6)`;
    pctx.fillStyle = dotRgb;
    const dotSize = 1;
    pctx.beginPath();
    pctx.arc(2, 2, dotSize, 0, Math.PI * 2);
    pctx.arc(6, 6, dotSize, 0, Math.PI * 2);
    pctx.fill();

    // Create pattern
    return this.ctx.createPattern(patternCanvas, 'repeat');
  }

  disconnect(): void {
    const c = this.container;
    if (this.pointerCapture !== null) {
      c.releasePointerCapture(this.pointerCapture);
    }
    c.removeEventListener('pointerdown', this.boundPointerDown);
    c.removeEventListener('pointerup', this.boundPointerUp);
    c.removeEventListener('pointermove', this.boundPointerMove);
    c.removeEventListener('wheel', this.boundWheel);
    c.removeEventListener('pointerleave', this.boundPointerLeave);
    this.observer.disconnect();
  }

  private mousePos(e: PointerEvent): [number, number] {
    const dims = this.container.getBoundingClientRect();
    const x = e.clientX - dims.left;
    const y = e.clientY - dims.top;
    return [x, y];
  }

  private pointerDown(e: PointerEvent): void {
    this.dragStart = this.mousePos(e);
    this.pointerCapture = e.pointerId;
    this.container.setPointerCapture(this.pointerCapture);
  }

  private pointerUp(e: PointerEvent): void {
    const wasClick = this.dragStart && !this.dragging;

    this.dragStart = null;
    if (this.dragging) {
      this.dragging = false;
      this.dragId++;
    }
    if (this.pointerCapture !== null) {
      this.container.releasePointerCapture(this.pointerCapture);
    }

    // Handle click (not drag) - pass clicked timestamp to callback
    if (wasClick && this.onLogSelect && this.mouseX !== null) {
      const timestamp = this.axis.pixel2time(this.mouseX);
      this.onLogSelect(timestamp);
    }
  }

  /** Yield all indicators in render order (optionally include hover) */
  private *getNamedIndicators(includeHover: boolean = false): Generator<VerticalIndicator> {
    // Render order: range indicators → dashboard indicators → selected → hover
    // This ensures proper z-ordering (back to front)
    if (this.rangeStartIndicator) yield this.rangeStartIndicator;
    if (this.rangeEndIndicator) yield this.rangeEndIndicator;
    if (this.dashboardStartIndicator) yield this.dashboardStartIndicator;
    if (this.dashboardEndIndicator) yield this.dashboardEndIndicator;
    if (this.selectedIndicator) yield this.selectedIndicator;
    if (includeHover && this.hoverIndicator) yield this.hoverIndicator;
  }

  /**
   * Find the closest snap target within threshold of the given pixel X. Checks indicators first,
   * then grid lines (only if no indicator found). Returns timestamp and matching indicators.
   */
  private findSnapTarget(pixelX: number): { timestamp: number; indicators: VerticalIndicator[] } | null {
    let closestTimestamp: number | null = null;
    let closestDistance = Infinity;
    let closestIndicators: VerticalIndicator[] = [];

    // Check indicators first (priority over grid lines)
    for (const indicator of this.getNamedIndicators()) {
      const indicatorX = this.axis.time2pixel(indicator.getTimestamp());
      const distance = Math.abs(indicatorX - pixelX);
      if (distance < SNAP_THRESHOLD) {
        if (distance < closestDistance) {
          closestDistance = distance;
          closestTimestamp = indicator.getTimestamp();
          closestIndicators = [indicator];
        } else if (distance === closestDistance) {
          closestIndicators.push(indicator);
        }
      }
    }

    // Only check grid lines if no indicator was found
    if (closestTimestamp === null) {
      for (const timestamp of this.axis.getGridLineTimestamps()) {
        const gridX = this.axis.time2pixel(timestamp);
        const distance = Math.abs(gridX - pixelX);
        if (distance < GRID_SNAP_THRESHOLD && distance < closestDistance) {
          closestDistance = distance;
          closestTimestamp = timestamp;
        }
      }
    }

    if (closestTimestamp === null) {
      return null;
    }

    return { timestamp: closestTimestamp, indicators: closestIndicators };
  }

  private pointerMove(e: PointerEvent): void {
    const cur = this.mousePos(e);

    // Track mouse X position and update hover indicator
    this.mouseX = cur[0];
    if (!this.dragging) {
      // Check for snap targets first
      const snapResult = this.findSnapTarget(this.mouseX);
      const timestamp = snapResult?.timestamp ?? this.axis.pixel2time(this.mouseX);
      const displayX = snapResult !== null ? this.axis.time2pixel(snapResult.timestamp) : cur[0];

      // Find histogram bin for this timestamp
      const bin = this.logCountIndex?.findBinForTimestamp(timestamp) ?? null;

      // Compute beyond flags
      const beyondLogs = this.fullTimeRange !== null &&
        (timestamp < this.fullTimeRange[0] || timestamp > this.fullTimeRange[1]);
      const beyondVisible = this.visibleRange !== null &&
        (timestamp < this.visibleRange[0] || timestamp > this.visibleRange[1]);
      const beyondDashboard = this.dashboardRange !== null &&
        (timestamp < this.dashboardRange[0] || timestamp > this.dashboardRange[1]);

      this.setHoveredTimestamp(timestamp);
      // Update tooltip with position, timestamp, indicators, bin, and beyond flags
      this.onTooltip?.({
        x: displayX,
        y: cur[1],
        timestamp,
        indicators: snapResult?.indicators ?? [],
        bin,
        beyondLogs,
        beyondVisible,
        beyondDashboard,
      });
    } else {
      // Hide tooltip while dragging
      this.onTooltip?.(null);
    }

    // Wait until we move a bit before initiating drag
    if (this.dragStart && !this.dragging) {
      const dist = Math.sqrt(
        Math.pow(this.dragStart[1] - cur[1], 2) + Math.pow(this.dragStart[0] - cur[0], 2)
      );
      if (dist > DRAG_THRESHOLD) {
        this.dragging = true;
      }
    }

    if (this.dragging && this.dragStart) {
      this.axis.shift(this.dragId, this.dragStart[0], cur[0]);
    }
  }

  private wheel(evt: WheelEvent): void {
    evt.preventDefault();

    // Disallow while clicking/dragging
    if (this.dragStart) return;

    // Conversion factor from wheel delta to approximate pixels
    let fac = 1;
    switch (evt.deltaMode) {
      case WheelEvent.DOM_DELTA_LINE:
        fac = 40;
        break;
      case WheelEvent.DOM_DELTA_PAGE:
        fac = 800;
        break;
    }

    // Figure out zoom vs shift distances
    let zoom = evt.deltaZ;
    let shift = evt.deltaX;
    // Use vertical scroll as fallback if others are not provided
    if (evt.shiftKey && !shift) {
      shift = -evt.deltaY;
    } else if (!zoom) {
      zoom = evt.deltaY;
    }
    shift *= fac*.25; // shift I think benefits from being a little finer
    zoom *= fac;

    // Perform view adjustment
    const x = this.mousePos(evt as any)[0];
    if (zoom) {
      this.axis.zoom(zoom, x);
    }
    if (shift) {
      this.axis.shift(null, x, x + shift);
    }
  }

  private pointerLeave(e: PointerEvent): void {
    this.mouseX = null;
    this.setHoveredTimestamp(null);
    this.onTooltip?.(null);
  }

  /**
   * Set callback for log selection
   */
  setOnLogSelect(callback: (timestamp: number) => void): void {
    this.onLogSelect = callback;
  }

  /**
   * Set callback for tooltip updates
   */
  setOnTooltip(callback: (data: TooltipData | null) => void): void {
    this.onTooltip = callback;
  }

  /**
   * Set callback for range info updates
   */
  setOnRangeInfo(callback: (info: RangeInfo | null) => void): void {
    this.onRangeInfo = callback;
  }

  /**
   * Show tooltip at a given timestamp (for shared tooltip / external hover)
   */
  showTooltipAtTimestamp(timestamp: number | null): void {
    if (timestamp === null) {
      this.onTooltip?.(null);
      return;
    }

    const x = this.axis.time2pixel(timestamp);

    // Compute beyond flags
    const beyondLogs = this.fullTimeRange !== null &&
      (timestamp < this.fullTimeRange[0] || timestamp > this.fullTimeRange[1]);
    const beyondVisible = this.visibleRange !== null &&
      (timestamp < this.visibleRange[0] || timestamp > this.visibleRange[1]);
    const beyondDashboard = this.dashboardRange !== null &&
      (timestamp < this.dashboardRange[0] || timestamp > this.dashboardRange[1]);

    // Find indicators at this timestamp
    const indicators: typeof this.selectedIndicator[] = [];
    for (const ind of this.getNamedIndicators()) {
      if (ind.getTimestamp() === timestamp) {
        indicators.push(ind);
      }
    }

    // Find histogram bin for this timestamp
    const bin = this.logCountIndex?.findBinForTimestamp(timestamp) ?? null;

    this.onTooltip?.({
      x,
      y: 0,
      timestamp,
      indicators: indicators.filter((i): i is NonNullable<typeof i> => i !== null),
      bin,
      beyondLogs,
      beyondVisible,
      beyondDashboard,
    });
  }

  updateDims(width: number, height: number): void {
    // Store logical dimensions for rendering calculations
    this.logicalWidth = width;
    this.logicalHeight = height;

    // Only apply HiDPI scaling when devicePixelRatio > 1 (retina displays)
    // When dpr < 1 (zoomed out), scaling would make things blurry
    const dpr = window.devicePixelRatio || 1;
    const scaleFactor = dpr > 1 ? dpr : 1;

    // Set canvas buffer size (scaled for HiDPI if applicable)
    this.canvas.width = Math.floor(width * scaleFactor);
    this.canvas.height = Math.floor(height * scaleFactor);

    // Set CSS size to logical dimensions
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Scale context for HiDPI rendering
    if (scaleFactor > 1) {
      this.ctx.scale(scaleFactor, scaleFactor);
    }

    // Re-apply context settings (reset when canvas size changes)
    this.ctx.imageSmoothingEnabled = false;

    // Axis works in logical pixels
    this.axis.updateWidth(width);
    this.render();
  }

  /**
   * Set the raw timestamp data and calculate the time range
   * If dashboardRange is provided, use it for initial zoom instead of full log range
   * @param timestamps - list of timestamps for each log record
   * @param dashboardRange - full time range of the dashboard
   */
  setData(timestamps: number[], dashboardRange?: [number, number]): void {
    const previousTimeRange = this.fullTimeRange;
    const currentZoom = this.axis.getZoomRange();

    // Calculate time range from timestamps
    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const timestamp of timestamps) {
      if (timestamp < minTime) minTime = timestamp;
      if (timestamp > maxTime) maxTime = timestamp;
    }

    // If all logs have the same timestamp (or no logs), add some padding
    if (minTime === maxTime || timestamps.length === 0) {
      if (timestamps.length === 0) {
        minTime = 0;
        maxTime = 0;
      } else {
        minTime -= 1000; // 1 second before
        maxTime += 1000; // 1 second after
      }
    }

    const fullTimeRange: [number, number] = [minTime, maxTime];
    this.fullTimeRange = fullTimeRange;
    this.logCountIndex = new LogCountIndex(timestamps);

    // Preserve zoom if time range hasn't changed
    const rangeUnchanged = previousTimeRange &&
      previousTimeRange[0] === fullTimeRange[0] &&
      previousTimeRange[1] === fullTimeRange[1];

    const initialRange = rangeUnchanged && currentZoom
      ? currentZoom
      : (dashboardRange || fullTimeRange);

    this.axis.updateRange(fullTimeRange, initialRange);
    this.render();
  }

  /**
   * Set the hovered timestamp to display a vertical line
   */
  setHoveredTimestamp(timestamp: number | null): void {
    if (timestamp !== null) {
      if (!this.hoverIndicator) {
        this.hoverIndicator = IndicatorFactory.createHover(timestamp, this.colorScheme);
      } else {
        this.hoverIndicator.setTimestamp(timestamp);
      }
    } else {
      this.hoverIndicator = null;
    }
    this.render();
  }

  /**
   * Set the selected timestamp to display a vertical line (solid)
   */
  setSelectedTimestamp(timestamp: number | null): void {
    if (timestamp !== null) {
      if (!this.selectedIndicator) {
        this.selectedIndicator = IndicatorFactory.createSelection(timestamp, this.colorScheme);
      } else {
        this.selectedIndicator.setTimestamp(timestamp);
      }
    } else {
      this.selectedIndicator = null;
    }
    this.render();
  }

  /**
   * Set the visible range to display bracket indicators
   * When sortOrder is 'desc', indicators are swapped because first visible row has later timestamp
   */
  setVisibleRange(firstTimestamp: number | null, lastTimestamp: number | null, sortOrder: 'asc' | 'desc' = 'asc'): void {
    // In descending order, swap the indicators:
    // - First visible row has later timestamp → needs left bracket (range end)
    // - Last visible row has earlier timestamp → needs right bracket (range start)
    const isDescending = sortOrder === 'desc';

    if (firstTimestamp !== null) {
      if (!this.rangeStartIndicator) {
        const direction = isDescending ? 'left' : 'right';
        this.rangeStartIndicator = IndicatorFactory.createVisible(firstTimestamp, direction, this.colorScheme);
      } else {
        this.rangeStartIndicator.setTimestamp(firstTimestamp);
      }
    } else {
      this.rangeStartIndicator = null;
    }

    if (lastTimestamp !== null) {
      if (!this.rangeEndIndicator) {
        const direction = isDescending ? 'right' : 'left';
        this.rangeEndIndicator = IndicatorFactory.createVisible(lastTimestamp, direction, this.colorScheme);
      } else {
        this.rangeEndIndicator.setTimestamp(lastTimestamp);
      }
    } else {
      this.rangeEndIndicator = null;
    }

    // Track visible range for beyondVisible check
    if (firstTimestamp !== null && lastTimestamp !== null) {
      this.visibleRange = isDescending
        ? [lastTimestamp, firstTimestamp]
        : [firstTimestamp, lastTimestamp];
    } else {
      this.visibleRange = null;
    }

    this.render();
  }

  /**
   * Update and emit range info (logs outside zoom range)
   * Called after visible range changes or timeline navigation
   */
  private updateRangeInfo(): void {
    const zoomRange = this.axis.getZoomRange();
    if (this.logCountIndex && zoomRange) {
      const counts = this.logCountIndex.countByRange(zoomRange[0], zoomRange[1]);
      this.onRangeInfo?.({
        before: counts.before,
        after: counts.after,
      });
    } else {
      this.onRangeInfo?.(null);
    }
  }

  /**
   * Set the dashboard time range to display red bracket indicators
   */
  setDashboardRange(fromTimestamp: number, toTimestamp: number): void {
    // Start indicator (right bracket pointing inward)
    if (!this.dashboardStartIndicator) {
      this.dashboardStartIndicator = IndicatorFactory.createDashboard(fromTimestamp, 'right', this.colorScheme);
    } else {
      this.dashboardStartIndicator.setTimestamp(fromTimestamp);
    }

    // End indicator (left bracket pointing inward)
    if (!this.dashboardEndIndicator) {
      this.dashboardEndIndicator = IndicatorFactory.createDashboard(toTimestamp, 'left', this.colorScheme);
    } else {
      this.dashboardEndIndicator.setTimestamp(toTimestamp);
    }

    // Track dashboard range for beyondDashboard check
    this.dashboardRange = [fromTimestamp, toTimestamp];

    this.render();
  }

  /**
   * Update the color scheme and regenerate patterns
   */
  setColorScheme(colorScheme: ColorScheme): void {
    this.colorScheme = colorScheme;
    // Regenerate the dotted pattern with new colors
    this.grayPattern = this.createDottedPattern();
    // Update the axis color scheme
    this.axis.setColorScheme(colorScheme);

    // Update all indicator colors based on the new color scheme
    for (const indicator of this.getNamedIndicators(true)) {
      indicator.setColorScheme(colorScheme);
    }

    this.render();
  }

  /**
   * Update the font family for axis labels
   */
  setFontFamily(fontFamily: string): void {
    this.axis.setFontFamily(fontFamily);
    this.render();
  }

  /**
   * Reset zoom to full range
   */
  recenter(): void {
    if (this.fullTimeRange) {
      this.axis.resetZoom(this.fullTimeRange);
    }
  }

  /**
   * Get current zoom range
   */
  getZoomRange(): [number, number] | null {
    return this.axis.getZoomRange();
  }

  /**
   * Calculate optimal bin count for histogram based on full log range
   * @param zoomRange - Current zoom range [start, end] in milliseconds
   * @param availableWidth - Width in pixels available for rendering the histogram
   * @returns Optimal number of bins
   */
  private calculateOptimalBinCount(zoomRange: [number, number], availableWidth: number): number {
    if (!this.fullTimeRange) {
      return 1;
    }

    const fullTimeRangeMs = this.fullTimeRange[1] - this.fullTimeRange[0];
    const zoomRangeMs = zoomRange[1] - zoomRange[0];

    // Find max bins where each bin is >= TARGET_PIXELS_PER_BIN pixels wide on screen
    const maxBins = Math.floor(
      (fullTimeRangeMs * availableWidth) / (TARGET_PIXELS_PER_BIN * zoomRangeMs)
    );
    return Math.max(1, maxBins);
  }

  render(): void {
    const zoomRange = this.getZoomRange();
    // setData not called yet
    if (!zoomRange) return

    // Use logical dimensions (not scaled canvas buffer size)
    const width = this.logicalWidth;
    const height = this.logicalHeight;
    const axisHeight = this.axis.getHeight();
    const histogramHeight = height - axisHeight;

    this.ctx.fillStyle = colorToCSS(this.colorScheme.background ?? { r: 31, g: 31, b: 35 });
    this.ctx.fillRect(0, 0, width, height);
    this.renderHistogram(zoomRange, histogramHeight);
    this.renderBeyondLogs(zoomRange, histogramHeight);
    this.axis.y = histogramHeight;
    this.axis.render(this.ctx);
    this.renderIndicators(zoomRange, histogramHeight);

    // Update range info after rendering (for zoom/pan navigation)
    this.updateRangeInfo();
  }

  private renderHistogram(zoomRange: [number, number], availableHeight: number): void {
    if (!this.logCountIndex || !this.fullTimeRange) return;

    // Divide the full log range evenly. This ensures bins have consistent boundaries regardless of
    // zoom level. I considered having bins tied to the major/minor grid lines, however we'd get
    // some bins (clamped start/end, or DST/month length differences) which are not the same size.
    // My thinking for now is consistent bin widths is more desirable than alignment.
    const binCount = this.calculateOptimalBinCount(zoomRange, this.logicalWidth);
    const binWidth = (this.fullTimeRange[1] - this.fullTimeRange[0]) / binCount;

    // Calculate which bins are visible in the current zoom range
    const firstBinIndex = Math.floor((zoomRange[0] - this.fullTimeRange[0]) / binWidth);
    const lastBinIndex = Math.ceil((zoomRange[1] - this.fullTimeRange[0]) / binWidth);

    // Reset index and generate only the visible bins
    const firstBinStart = this.fullTimeRange[0] + firstBinIndex * binWidth;
    this.logCountIndex.reset(firstBinStart);
    let maxCount = 0;

    for (let i = firstBinIndex; i < lastBinIndex && i < binCount; i++) {
      const endTime = this.fullTimeRange[0] + (i + 1) * binWidth;
      const count = this.logCountIndex.count(endTime);
      if (count > maxCount) {
        maxCount = count;
      }
    }

    const bins = this.logCountIndex.getBins();
    if (maxCount === 0) return;

    // Draw histogram bars using foreground color
    const histogramColor = this.colorScheme.foreground ?? { r: 255, g: 255, b: 255 };
    this.ctx.fillStyle = colorToCSS(histogramColor);

    for (const bin of bins) {
      const x1 = this.axis.time2pixel(bin.startTime);
      const x2 = this.axis.time2pixel(bin.endTime);
      const barWidth = Math.max(1, x2 - x1);

      // Apply logarithmic scaling with stretched gap between 0 and 1
      let barHeight: number;
      if (bin.count === 0) {
        barHeight = 0;
      } else if (bin.count === 1) {
        barHeight = availableHeight * 0.15; // 15% height for single log
      } else {
        // Logarithmic scale for counts > 1
        const logScale = Math.log(bin.count + 1) / Math.log(maxCount + 1);
        barHeight = availableHeight * (0.15 + 0.85 * logScale);
      }

      this.ctx.fillRect(x1, availableHeight - barHeight, barWidth, barHeight);
    }
  }

  /**
   * Render grayed out area where there is no log data
   */
  private renderBeyondLogs(zoomRange: [number, number], availableHeight: number): void {
    // Draw grayed out areas where no data exists (with dotted pattern)
    if (this.fullTimeRange && this.grayPattern) {
      this.ctx.fillStyle = this.grayPattern;

      // Left gray area
      if (zoomRange[0] < this.fullTimeRange[0]) {
        const x1 = this.axis.time2pixel(zoomRange[0]);
        const x2 = this.axis.time2pixel(this.fullTimeRange[0]);
        this.ctx.fillRect(x1, 0, x2 - x1, availableHeight);
      }

      // Right gray area
      if (zoomRange[1] > this.fullTimeRange[1]) {
        const x1 = this.axis.time2pixel(this.fullTimeRange[1]);
        const x2 = this.axis.time2pixel(zoomRange[1]);
        this.ctx.fillRect(x1, 0, x2 - x1, availableHeight);
      }
    }
  }

  /**
   * Render all indicators (hover, selections, ranges, etc.)
   */
  private renderIndicators(zoomRange: [number, number], availableHeight: number): void {
    // Render all indicators in proper z-order (including hover on top)
    for (const indicator of this.getNamedIndicators(true)) {
      if (indicator.isVisible(zoomRange)) {
        const x = this.axis.time2pixel(indicator.getTimestamp());
        indicator.render(this.ctx, x, 0, availableHeight);
      }
    }
  }
}
