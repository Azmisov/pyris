/**
 * LogsTimeline component
 * Displays a timeline view of log distribution with zoom/pan controls
 */

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Icon } from '@grafana/ui';
import { TimelineChart, TooltipData } from './TimelineChart';
import { TimelineTooltip } from './TimelineTooltip';
import { AnsiLogRow } from '../../types';
import { ColorScheme } from '../../theme/colorSchemes';
import styles from './index.module.css';

interface LogsTimelineProps {
  logs: AnsiLogRow[];
  height?: number;
  hoveredTimestamp?: number | null;
  selectedTimestamp?: number | null;
  visibleRange?: { first: number | null; last: number | null };
  colorScheme: ColorScheme;
  sortOrder?: 'asc' | 'desc';
  onTimeRangeChange?: (startTime: number, endTime: number) => void;
  onLogSelect?: (timestamp: number) => void;
  dashboardTimeRange?: { from: number; to: number };
  fontFamily?: string;
  timeZone?: string;
}

const DEFAULT_HEIGHT = 100;
const BIN_TARGET_COUNT = 100;

/**
 * Calculate histogram bins from log data
 */
function calculateHistogram(logs: AnsiLogRow[], binCount: number) {
  if (logs.length === 0) {
    return { timeRange: [0, 0] as [number, number], histogram: [] };
  }

  // Find time range (timestamps are in milliseconds)
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const log of logs) {
    const timeMs = log.timestamp;
    if (timeMs < minTime) minTime = timeMs;
    if (timeMs > maxTime) maxTime = timeMs;
  }

  // If all logs have the same timestamp, add some padding
  if (minTime === maxTime) {
    minTime -= 1000; // 1 second before
    maxTime += 1000; // 1 second after
  }

  const timeRange: [number, number] = [minTime, maxTime];
  const binWidth = (maxTime - minTime) / binCount;

  // Create bins
  const bins = new Array(binCount).fill(0).map((_, i) => ({
    startTime: minTime + i * binWidth,
    endTime: minTime + (i + 1) * binWidth,
    count: 0,
  }));

  // Fill bins
  for (const log of logs) {
    const timeMs = log.timestamp;
    const binIndex = Math.min(Math.floor((timeMs - minTime) / binWidth), binCount - 1);
    if (binIndex >= 0 && binIndex < binCount) {
      bins[binIndex].count++;
    }
  }

  return { timeRange, histogram: bins };
}

export const LogsTimeline: React.FC<LogsTimelineProps> = ({
  logs,
  height = DEFAULT_HEIGHT,
  hoveredTimestamp = null,
  selectedTimestamp = null,
  visibleRange = { first: null, last: null },
  colorScheme,
  sortOrder = 'asc',
  onTimeRangeChange,
  onLogSelect,
  dashboardTimeRange,
  fontFamily,
  timeZone,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<TimelineChart | null>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);

  // Calculate histogram data
  const { timeRange, histogram } = useMemo(() => {
    return calculateHistogram(logs, BIN_TARGET_COUNT);
  }, [logs]);

  // Initialize chart (only once)
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = new TimelineChart(containerRef.current, colorScheme, fontFamily, timeZone);
    chartRef.current = chart;

    return () => {
      chart.disconnect();
      chartRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update color scheme when it changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setColorScheme(colorScheme);
    }
  }, [colorScheme]);

  // Update font family when it changes
  useEffect(() => {
    if (chartRef.current && fontFamily) {
      chartRef.current.setFontFamily(fontFamily);
    }
  }, [fontFamily]);

  // Set log selection callback
  useEffect(() => {
    if (chartRef.current && onLogSelect) {
      chartRef.current.setOnLogSelect(onLogSelect);
    }
  }, [onLogSelect]);

  // Set tooltip callback
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setOnTooltip(setTooltipData);
    }
  }, []);

  // Update chart data when logs change
  useEffect(() => {
    if (chartRef.current && timeRange && histogram) {
      const dashboardRangeMs = dashboardTimeRange
        ? [dashboardTimeRange.from, dashboardTimeRange.to] as [number, number]
        : undefined;
      chartRef.current.setData(timeRange, histogram, dashboardRangeMs);
    }
  }, [timeRange, histogram, dashboardTimeRange]);

  // Update dashboard time range indicators
  useEffect(() => {
    if (chartRef.current && dashboardTimeRange) {
      chartRef.current.setDashboardRange(dashboardTimeRange.from, dashboardTimeRange.to);
    }
  }, [dashboardTimeRange]);

  // Update hovered timestamp
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setHoveredTimestamp(hoveredTimestamp ?? null);
    }
  }, [hoveredTimestamp]);

  // Update selected timestamp
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setSelectedTimestamp(selectedTimestamp ?? null);
    }
  }, [selectedTimestamp]);

  // Update visible range indicators
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setVisibleRange(visibleRange.first ?? null, visibleRange.last ?? null, sortOrder);
    }
  }, [visibleRange, sortOrder]);

  // Recenter button handler
  const handleRecenter = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.recenter();
    }
  }, []);

  // Sync button handler (updates dashboard time range)
  const handleSync = useCallback(() => {
    if (chartRef.current && onTimeRangeChange) {
      const zoomRange = chartRef.current.getZoomRange();
      if (zoomRange) {
        onTimeRangeChange(zoomRange[0], zoomRange[1]);
      }
    }
  }, [onTimeRangeChange]);

  return (
    <div className={styles['logs-timeline']} style={{ position: 'relative', height }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#1a1a1a',
        }}
      />
      <div
        className="timeline-controls"
        style={{
          position: 'absolute',
          top: 5,
          right: 10,
          display: 'flex',
          gap: '5px',
        }}
      >
        <button
          onClick={handleRecenter}
          className={styles['timeline-icon-button']}
          title="Center to log's time range"
        >
          <Icon name="home-alt" />
        </button>
        {onTimeRangeChange && (
          <button
            onClick={handleSync}
            className={styles['timeline-icon-button']}
            title="Update dashboard time range to match current view"
          >
            <Icon name="clock-nine" />
          </button>
        )}
      </div>
      {tooltipData && <TimelineTooltip data={tooltipData} timeZone={timeZone} />}
    </div>
  );
};

export default LogsTimeline;
