/**
 * Timeline chart class
 * Manages canvas rendering, mouse events, and coordinate transformations
 */

import { TimeAxis } from './TimeAxis';
import { ColorScheme } from '../../theme/colorSchemes';
import { VerticalIndicator, IndicatorFactory } from './VerticalIndicator';

interface HistogramBin {
  startTime: number;
  endTime: number;
  count: number;
}

const DRAG_THRESHOLD = 3;

// Helper to convert AnsiColor to CSS color
function colorToCSS(color: { r: number; g: number; b: number } | undefined, fallback: string): string {
  return color ? `rgb(${color.r}, ${color.g}, ${color.b})` : fallback;
}

export class TimelineChart {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private observer: ResizeObserver;
  public axis: TimeAxis;
  private histogram: HistogramBin[] = [];
  private fullTimeRange: [number, number] | null = null;
  private grayPattern: CanvasPattern | null = null;
  private hoverIndicator: VerticalIndicator | null = null;
  private rangeStartIndicator: VerticalIndicator | null = null;
  private rangeEndIndicator: VerticalIndicator | null = null;
  private colorScheme: ColorScheme;
  private indicators: VerticalIndicator[] = [];

  // Mouse state
  private dragId: number = 0;
  private dragStart: [number, number] | null = null;
  private dragging: boolean = false;
  private pointerCapture: number | null = null;

  // Event handlers (bound methods)
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundWheel: (e: WheelEvent) => void;

  constructor(container: HTMLDivElement, colorScheme: ColorScheme) {
    this.container = container;
    this.colorScheme = colorScheme;
    this.canvas = document.createElement('canvas');
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    this.ctx = ctx;

    this.axis = new TimeAxis(this, colorScheme);

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

    // Add event listeners
    container.addEventListener('pointerdown', this.boundPointerDown);
    container.addEventListener('pointerup', this.boundPointerUp);
    container.addEventListener('pointermove', this.boundPointerMove);
    container.addEventListener('wheel', this.boundWheel);
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

    // Use bgAccent3 or fallback for subtle background
    const bgColor = this.colorScheme.bgAccent3 || this.colorScheme.background;
    const bgRgb = bgColor ? `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, 0.1)` : 'rgba(80, 80, 80, 0.1)';
    pctx.fillStyle = bgRgb;
    pctx.fillRect(0, 0, patternSize, patternSize);

    // Use bgAccent2 or fallback for dots
    const dotColor = this.colorScheme.bgAccent2 || bgColor;
    const dotRgb = dotColor ? `rgba(${dotColor.r}, ${dotColor.g}, ${dotColor.b}, 0.4)` : 'rgba(100, 100, 100, 0.4)';
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
    this.dragStart = null;
    if (this.dragging) {
      this.dragging = false;
      this.dragId++;
    }
    if (this.pointerCapture !== null) {
      this.container.releasePointerCapture(this.pointerCapture);
    }
  }

  private pointerMove(e: PointerEvent): void {
    const cur = this.mousePos(e);

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
      this.axis.mousedrag({
        id: this.dragId,
        start: this.dragStart,
        end: cur,
      });
    }
  }

  private wheel(evt: WheelEvent): void {
    evt.preventDefault();

    // Disallow while clicking/dragging
    if (this.dragStart) return;

    let fac = evt.deltaY;
    switch (evt.deltaMode) {
      case WheelEvent.DOM_DELTA_LINE:
        fac *= 16;
        break;
      case WheelEvent.DOM_DELTA_PAGE:
        fac *= 960;
        break;
    }

    if (!fac) return;

    this.axis.mousewheel({
      factor: fac,
      shift: evt.shiftKey,
      position: this.mousePos(evt as any),
    });
  }

  updateDims(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.axis.updateWidth(width);
    this.render();
  }

  /**
   * Set the time range and histogram data
   */
  setData(timeRange: [number, number], histogram: HistogramBin[]): void {
    this.fullTimeRange = timeRange;
    this.histogram = histogram;
    this.axis.updateRange(timeRange);
    this.render();
  }

  /**
   * Set the hovered timestamp to display a vertical line
   */
  setHoveredTimestamp(timestamp: number | null): void {
    if (timestamp !== null) {
      const hoverColor = this.colorScheme.colors[14] || this.colorScheme.colors[12];
      if (!this.hoverIndicator) {
        this.hoverIndicator = IndicatorFactory.createHover(
          timestamp,
          colorToCSS(hoverColor, '#4a9eff')
        );
      } else {
        this.hoverIndicator.updateConfig({ timestamp });
      }
    } else {
      this.hoverIndicator = null;
    }
    this.render();
  }

  /**
   * Set the visible range to display bracket indicators
   * When sortOrder is 'desc', indicators are swapped because first visible row has later timestamp
   */
  setVisibleRange(firstTimestamp: number | null, lastTimestamp: number | null, sortOrder: 'asc' | 'desc' = 'asc'): void {
    // Use yellow/orange color for visible range brackets
    const rangeColor = this.colorScheme.colors[11] || this.colorScheme.colors[3]; // Bright yellow or yellow
    const colorStr = colorToCSS(rangeColor, '#ffaa00');

    // In descending order, swap the indicators:
    // - First visible row has later timestamp → needs left bracket (range end)
    // - Last visible row has earlier timestamp → needs right bracket (range start)
    const isDescending = sortOrder === 'desc';

    if (firstTimestamp !== null) {
      if (!this.rangeStartIndicator) {
        this.rangeStartIndicator = isDescending
          ? IndicatorFactory.createRangeEnd(firstTimestamp, colorStr)
          : IndicatorFactory.createRangeStart(firstTimestamp, colorStr);
      } else {
        this.rangeStartIndicator.updateConfig({
          timestamp: firstTimestamp,
          direction: isDescending ? 'left' : 'right'
        });
      }
    } else {
      this.rangeStartIndicator = null;
    }

    if (lastTimestamp !== null) {
      if (!this.rangeEndIndicator) {
        this.rangeEndIndicator = isDescending
          ? IndicatorFactory.createRangeStart(lastTimestamp, colorStr)
          : IndicatorFactory.createRangeEnd(lastTimestamp, colorStr);
      } else {
        this.rangeEndIndicator.updateConfig({
          timestamp: lastTimestamp,
          direction: isDescending ? 'right' : 'left'
        });
      }
    } else {
      this.rangeEndIndicator = null;
    }

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

    // Update hover indicator color if it exists
    if (this.hoverIndicator) {
      const hoverColor = this.colorScheme.colors[14] || this.colorScheme.colors[12];
      this.hoverIndicator.updateConfig({
        style: {
          color: colorToCSS(hoverColor, '#4a9eff'),
          lineWidth: 2,
          dashed: true,
          dashPattern: [4, 4],
        },
      });
    }

    // Update range indicator colors if they exist
    const rangeColor = this.colorScheme.colors[11] || this.colorScheme.colors[3];
    const colorStr = colorToCSS(rangeColor, '#ffaa00');
    if (this.rangeStartIndicator) {
      this.rangeStartIndicator.updateConfig({
        style: {
          color: colorStr,
          lineWidth: 2,
          dashed: false,
        },
      });
    }
    if (this.rangeEndIndicator) {
      this.rangeEndIndicator.updateConfig({
        style: {
          color: colorStr,
          lineWidth: 2,
          dashed: false,
        },
      });
    }

    this.render();
  }

  /**
   * Reset zoom to full range
   */
  recenter(): void {
    this.axis.resetZoom();
  }

  /**
   * Get current zoom range
   */
  getZoomRange(): [number, number] | null {
    return this.axis.getZoomRange();
  }

  /**
   * Get full time range
   */
  getFullRange(): [number, number] | null {
    return this.axis.getFullRange();
  }

  render(): void {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas with theme background color
    this.ctx.fillStyle = colorToCSS(this.colorScheme.background, '#1a1a1a');
    this.ctx.fillRect(0, 0, width, height);

    const axisHeight = this.axis.getHeight();
    const histogramHeight = height - axisHeight;

    // Render histogram at top
    this.renderHistogram(0, histogramHeight);

    // Render all indicators at top
    this.renderIndicators(0, histogramHeight);

    // Render time axis at bottom
    this.axis.y = histogramHeight;
    this.axis.render(this.ctx, height);
  }

  private renderHistogram(yOffset: number, availableHeight: number): void {
    if (this.histogram.length === 0) return;

    const zoomRange = this.axis.getZoomRange();
    if (!zoomRange) return;

    // Find max count for scaling
    let maxCount = 0;
    for (const bin of this.histogram) {
      if (bin.count > maxCount) {
        maxCount = bin.count;
      }
    }

    if (maxCount === 0) return;

    // Draw histogram bars using bright cyan or bright blue from palette
    const histogramColor = this.colorScheme.colors[14] || this.colorScheme.colors[12];
    this.ctx.fillStyle = colorToCSS(histogramColor, '#4a9eff');

    for (const bin of this.histogram) {
      // Skip bins outside zoom range
      if (bin.endTime < zoomRange[0] || bin.startTime > zoomRange[1]) {
        continue;
      }

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

      this.ctx.fillRect(x1, yOffset + availableHeight - barHeight, barWidth, barHeight);
    }

    // Draw grayed out areas where no data exists (with dotted pattern)
    if (this.fullTimeRange && this.grayPattern) {
      this.ctx.fillStyle = this.grayPattern;

      // Left gray area
      if (zoomRange[0] < this.fullTimeRange[0]) {
        const x1 = this.axis.time2pixel(zoomRange[0]);
        const x2 = this.axis.time2pixel(this.fullTimeRange[0]);
        this.ctx.fillRect(x1, yOffset, x2 - x1, availableHeight);
      }

      // Right gray area
      if (zoomRange[1] > this.fullTimeRange[1]) {
        const x1 = this.axis.time2pixel(this.fullTimeRange[1]);
        const x2 = this.axis.time2pixel(zoomRange[1]);
        this.ctx.fillRect(x1, yOffset, x2 - x1, availableHeight);
      }
    }
  }

  /**
   * Render all indicators (hover, selections, ranges, etc.)
   */
  private renderIndicators(yOffset: number, availableHeight: number): void {
    const zoomRange = this.axis.getZoomRange();
    if (!zoomRange) return;

    // Collect all indicators to render
    const allIndicators: VerticalIndicator[] = [];

    // Add range indicators (render first so they appear behind hover)
    if (this.rangeStartIndicator && this.rangeStartIndicator.isVisible(zoomRange)) {
      allIndicators.push(this.rangeStartIndicator);
    }
    if (this.rangeEndIndicator && this.rangeEndIndicator.isVisible(zoomRange)) {
      allIndicators.push(this.rangeEndIndicator);
    }

    // Add hover indicator (render after range indicators so it appears on top)
    if (this.hoverIndicator && this.hoverIndicator.isVisible(zoomRange)) {
      allIndicators.push(this.hoverIndicator);
    }

    // Add any additional custom indicators
    for (const indicator of this.indicators) {
      if (indicator.isVisible(zoomRange)) {
        allIndicators.push(indicator);
      }
    }

    // Render all indicators
    for (const indicator of allIndicators) {
      const x = this.axis.time2pixel(indicator.getTimestamp());
      indicator.render(this.ctx, x, yOffset, availableHeight);
    }
  }

  /**
   * Add a custom indicator to the timeline
   */
  addIndicator(indicator: VerticalIndicator): void {
    this.indicators.push(indicator);
    this.render();
  }

  /**
   * Remove an indicator from the timeline
   */
  removeIndicator(indicator: VerticalIndicator): void {
    const index = this.indicators.indexOf(indicator);
    if (index !== -1) {
      this.indicators.splice(index, 1);
      this.render();
    }
  }

  /**
   * Clear all custom indicators
   */
  clearIndicators(): void {
    this.indicators = [];
    this.render();
  }

  /**
   * Get all custom indicators
   */
  getIndicators(): VerticalIndicator[] {
    return [...this.indicators];
  }
}
