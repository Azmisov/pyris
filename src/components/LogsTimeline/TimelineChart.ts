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
  timestamp: number;
  /** Indicators at the snapped position */
  indicators: VerticalIndicator[];
  /** Histogram bin containing this timestamp, if any */
  bin: HistogramBin | null;
  /** Filtered histogram bin containing this timestamp, if any */
  filteredBin: HistogramBin | null;
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
  private filteredLogCountIndex: LogCountIndex | null = null;
  private fullTimeRange: [number, number] | null = null;
  // Logical dimensions (CSS pixels, not scaled)
  private logicalWidth = 0;
  private logicalHeight = 0;
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
  private dragId = 0;
  private dragStart: [number, number] | null = null;
  private dragging = false;
  private pointerCapture: number | null = null;
  private mouseX: number | null = null;
  private hoveredBin: HistogramBin | null = null;

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
    if (!pctx) {return null;}

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
  private *getNamedIndicators(includeHover = false): Generator<VerticalIndicator> {
    // Render order: range indicators → dashboard indicators → selected → hover
    // This ensures proper z-ordering (back to front)
    if (this.rangeStartIndicator) {yield this.rangeStartIndicator;}
    if (this.rangeEndIndicator) {yield this.rangeEndIndicator;}
    if (this.dashboardStartIndicator) {yield this.dashboardStartIndicator;}
    if (this.dashboardEndIndicator) {yield this.dashboardEndIndicator;}
    if (this.selectedIndicator) {yield this.selectedIndicator;}
    if (includeHover && this.hoverIndicator) {yield this.hoverIndicator;}
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
      // Snap to nearest indicator if within threshold
      const snapResult = this.findSnapTarget(this.mouseX);
      const timestamp = snapResult?.timestamp ?? this.axis.pixel2time(this.mouseX);

      this.showTooltipAtTimestamp(timestamp);
    } else {
      // Hide tooltip while dragging
      this.showTooltipAtTimestamp(null);
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
    if (this.dragStart) {return;}

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
    this.showTooltipAtTimestamp(null);
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
   * Also updates hover indicator and hovered bin for rendering
   */
  showTooltipAtTimestamp(timestamp: number | null): void {
    if (timestamp === null) {
      this.hoveredBin = null;
      this.setHoveredTimestamp(null);
      this.onTooltip?.(null);
      return;
    }

    // Find histogram bins for both unfiltered and filtered data
    const bin = this.logCountIndex?.findBinForTimestamp(timestamp) ?? null;
    let filteredBin = this.filteredLogCountIndex?.findBinForTimestamp(timestamp) ?? null;

    // When filter is active but no matching bin (0 filtered logs), create synthetic bin with count 0
    if (this.filteredLogCountIndex !== null && filteredBin === null && bin !== null) {
      filteredBin = { startTime: bin.startTime, endTime: bin.endTime, count: 0 };
    }

    // Update hover state BEFORE render - use filtered bin if available for highlighting
    this.hoveredBin = filteredBin ?? bin;
    this.setHoveredTimestamp(timestamp);

    // Compute beyond flags
    const beyondLogs = this.fullTimeRange !== null &&
      (timestamp < this.fullTimeRange[0] || timestamp > this.fullTimeRange[1]);
    const beyondVisible = this.visibleRange !== null &&
      (timestamp < this.visibleRange[0] || timestamp > this.visibleRange[1]);
    const beyondDashboard = this.dashboardRange !== null &&
      (timestamp < this.dashboardRange[0] || timestamp > this.dashboardRange[1]);

    this.onTooltip?.({
      x: this.axis.time2pixel(timestamp),
      timestamp,
      indicators: this.findIndicatorsAtTimestamp(timestamp),
      bin,
      filteredBin,
      beyondLogs,
      beyondVisible,
      beyondDashboard,
    });
  }

  /** Find all indicators at a given timestamp */
  private findIndicatorsAtTimestamp(timestamp: number): VerticalIndicator[] {
    const indicators: VerticalIndicator[] = [];
    for (const ind of this.getNamedIndicators()) {
      if (ind.getTimestamp() === timestamp) {
        indicators.push(ind);
      }
    }
    return indicators;
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
   * Set the initial zoom range (e.g., to dashboard time range on first load)
   */
  setInitialZoom(zoomRange: [number, number]): void {
    if (this.fullTimeRange) {
      this.axis.updateRange(this.fullTimeRange, zoomRange);
      this.render();
    }
  }

  /**
   * Set the raw timestamp data and calculate the time range
   * @param timestamps - list of timestamps for each log record
   */
  setData(timestamps: number[]): void {
    const previousTimeRange = this.fullTimeRange;
    const currentZoom = this.axis.getZoomRange();

    // Calculate time range from timestamps
    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const timestamp of timestamps) {
      if (timestamp < minTime) {minTime = timestamp;}
      if (timestamp > maxTime) {maxTime = timestamp;}
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

    // End bound is exclusive, so add 1ms to include the last timestamp
    const fullTimeRange: [number, number] = [minTime, maxTime + 1];
    this.fullTimeRange = fullTimeRange;
    this.logCountIndex = new LogCountIndex(timestamps);

    // Preserve zoom if time range hasn't changed, otherwise zoom to full range
    const rangeUnchanged = previousTimeRange &&
      previousTimeRange[0] === fullTimeRange[0] &&
      previousTimeRange[1] === fullTimeRange[1];

    const initialRange = rangeUnchanged && currentZoom
      ? currentZoom
      : fullTimeRange;

    this.axis.updateRange(fullTimeRange, initialRange);
    this.render();
  }

  /**
   * Set the filtered data for overlay histogram
   * @param timestamps - filtered timestamps, or undefined to clear
   */
  setFilteredData(timestamps: number[] | undefined): void {
    this.filteredLogCountIndex = timestamps
      ? new LogCountIndex(timestamps)
      : null;
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
   * Timestamps may be in any order depending on sort direction
   * Brackets always point inward toward the visible area
   */
  setVisibleRange(firstTimestamp: number | null, lastTimestamp: number | null): void {
    // Determine which timestamp is left (earlier) vs right (later) on timeline
    // Timeline always shows earlier times on left, later on right
    const leftTimestamp = firstTimestamp !== null && lastTimestamp !== null
      ? Math.min(firstTimestamp, lastTimestamp)
      : firstTimestamp ?? lastTimestamp;
    const rightTimestamp = firstTimestamp !== null && lastTimestamp !== null
      ? Math.max(firstTimestamp, lastTimestamp)
      : lastTimestamp ?? firstTimestamp;

    // Left indicator (bracket points right, toward visible area)
    if (leftTimestamp !== null) {
      if (!this.rangeStartIndicator) {
        this.rangeStartIndicator = IndicatorFactory.createVisible(leftTimestamp, 'right', this.colorScheme);
      } else {
        this.rangeStartIndicator.setTimestamp(leftTimestamp);
      }
    } else {
      this.rangeStartIndicator = null;
    }

    // Right indicator (bracket points left, toward visible area)
    if (rightTimestamp !== null) {
      if (!this.rangeEndIndicator) {
        this.rangeEndIndicator = IndicatorFactory.createVisible(rightTimestamp, 'left', this.colorScheme);
      } else {
        this.rangeEndIndicator.setTimestamp(rightTimestamp);
      }
    } else {
      this.rangeEndIndicator = null;
    }

    // Track visible range for beyondVisible check (always store as [min, max])
    if (leftTimestamp !== null && rightTimestamp !== null) {
      this.visibleRange = [leftTimestamp, rightTimestamp];
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
   * Expand zoom range to reveal logs on the specified side
   * @param position - 'left' to reveal logs before visible range, 'right' to reveal logs after
   */
  expandZoomToRevealLogs(position: 'left' | 'right'): void {
    if (!this.fullTimeRange) {
      return;
    }

    const currentZoom = this.axis.getZoomRange();
    if (!currentZoom) {
      return;
    }

    // Create new zoom range expanding to full range on the specified side
    const newZoomRange: [number, number] = position === 'left'
      ? [this.fullTimeRange[0], currentZoom[1]]
      : [currentZoom[0], this.fullTimeRange[1]];

    this.axis.setZoomRange(newZoomRange);
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
    if (!zoomRange) {return}

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

  /**
   * Calculate bar height using logarithmic scaling
   */
  private calculateBarHeight(count: number, maxCount: number, availableHeight: number): number {
    if (count === 0) {
      return 0;
    } else if (count === 1) {
      return availableHeight * 0.15; // 15% height for single log
    } else {
      // Logarithmic scale for counts > 1
      const logScale = Math.log(count + 1) / Math.log(maxCount + 1);
      return availableHeight * (0.15 + 0.85 * logScale);
    }
  }

  private renderHistogram(zoomRange: [number, number], availableHeight: number): void {
    if (!this.logCountIndex || !this.fullTimeRange) {return;}

    const histStart = performance.now();

    // Divide the full log range evenly. This ensures bins have consistent boundaries regardless of
    // zoom level. I considered having bins tied to the major/minor grid lines, however we'd get
    // some bins (clamped start/end, or DST/month length differences) which are not the same size.
    // My thinking for now is consistent bin widths is more desirable than alignment.
    const binCount = this.calculateOptimalBinCount(zoomRange, this.logicalWidth);
    const binWidth = (this.fullTimeRange[1] - this.fullTimeRange[0]) / binCount;

    // Calculate which bins are visible in the current zoom range (clamped to valid range)
    const firstBinIndex = Math.max(0, Math.floor((zoomRange[0] - this.fullTimeRange[0]) / binWidth));
    const lastBinIndex = Math.min(binCount, Math.ceil((zoomRange[1] - this.fullTimeRange[0]) / binWidth));

    // Reset index and generate only the visible bins for unfiltered data
    const firstBinStart = this.fullTimeRange[0] + firstBinIndex * binWidth;
    this.logCountIndex.reset(firstBinStart);
    let maxCount = 0;

    for (let i = firstBinIndex; i < lastBinIndex; i++) {
      const endTime = this.fullTimeRange[0] + (i + 1) * binWidth;
      const count = this.logCountIndex.count(endTime);
      if (count > maxCount) {
        maxCount = count;
      }
    }

    const allBins = this.logCountIndex.getBins();
    if (maxCount === 0) {return;}

    // Generate bins for filtered data (if active)
    let filteredBins: HistogramBin[] = [];
    if (this.filteredLogCountIndex) {
      this.filteredLogCountIndex.reset(firstBinStart);
      for (let i = firstBinIndex; i < lastBinIndex; i++) {
        const endTime = this.fullTimeRange[0] + (i + 1) * binWidth;
        this.filteredLogCountIndex.count(endTime);
      }
      filteredBins = this.filteredLogCountIndex.getBins();
    }

    const hasFilter = this.filteredLogCountIndex !== null;
    const histogramColor = this.colorScheme.foreground;
    const filteredColor = this.colorScheme.colors[12]; // Bright blue

    // Helper to draw histogram bars
    const drawBars = (bins: HistogramBin[], color: { r: number; g: number; b: number }, defaultOpacity: number, hoverOpacity: number, enableHover: boolean) => {
      for (const bin of bins) {
        const x1 = this.axis.time2pixel(bin.startTime);
        const x2 = this.axis.time2pixel(bin.endTime);
        const barWidth = Math.max(1, x2 - x1);
        const barHeight = this.calculateBarHeight(bin.count, maxCount, availableHeight);
        const isHovered = enableHover && this.hoveredBin && bin.startTime === this.hoveredBin.startTime;
        const opacity = isHovered ? hoverOpacity : defaultOpacity;
        this.ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
        this.ctx.fillRect(x1, availableHeight - barHeight, barWidth, barHeight);
      }
    };

    // Draw unfiltered histogram (dimmed when filter active, no hover highlight)
    drawBars(allBins, histogramColor, hasFilter ? 0.3 : 0.6, 1, !hasFilter);

    // Draw filtered histogram overlay (if active)
    if (hasFilter) {
      drawBars(filteredBins, filteredColor, 0.8, 1, true);
    }

    const histEnd = performance.now();
    const histTime = histEnd - histStart;
    if (histTime > 2) {
      console.log(`[renderHistogram] ${histTime.toFixed(1)}ms - binCount: ${binCount}, visibleBins: ${lastBinIndex - firstBinIndex}, drawnBins: ${allBins.length}, filteredBins: ${filteredBins.length}`);
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
