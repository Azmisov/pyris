/**
 * LogsTimeline component
 * Displays a timeline view of log distribution with zoom/pan controls
 */

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Icon } from '@grafana/ui';
import { TimelineChart } from './TimelineChart';
import { AnsiLogRow } from '../../types';
import { ColorScheme } from '../../theme/colorSchemes';

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

  // Find time range (timestamps are in milliseconds, convert to microseconds)
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const log of logs) {
    const timeUs = log.timestamp * 1000; // Convert ms to μs
    if (timeUs < minTime) minTime = timeUs;
    if (timeUs > maxTime) maxTime = timeUs;
  }

  // If all logs have the same timestamp, add some padding
  if (minTime === maxTime) {
    minTime -= 1000000; // 1 second before
    maxTime += 1000000; // 1 second after
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
    const timeUs = log.timestamp * 1000;
    const binIndex = Math.min(Math.floor((timeUs - minTime) / binWidth), binCount - 1);
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<TimelineChart | null>(null);

  // Calculate histogram data
  const { timeRange, histogram } = useMemo(() => {
    return calculateHistogram(logs, BIN_TARGET_COUNT);
  }, [logs]);

  // Initialize chart (only once)
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = new TimelineChart(containerRef.current, colorScheme);
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

  // Set log selection callback
  useEffect(() => {
    if (chartRef.current && onLogSelect) {
      chartRef.current.setOnLogSelect((timestampUs: number) => {
        // Convert from microseconds to milliseconds
        const timestampMs = Math.floor(timestampUs / 1000);
        onLogSelect(timestampMs);
      });
    }
  }, [onLogSelect]);

  // Update chart data when logs change
  useEffect(() => {
    if (chartRef.current && timeRange && histogram) {
      chartRef.current.setData(timeRange, histogram);
    }
  }, [timeRange, histogram]);

  // Update hovered timestamp
  useEffect(() => {
    if (chartRef.current) {
      // Convert from milliseconds to microseconds
      const timestampUs = hoveredTimestamp ? hoveredTimestamp * 1000 : null;
      chartRef.current.setHoveredTimestamp(timestampUs);
    }
  }, [hoveredTimestamp]);

  // Update selected timestamp
  useEffect(() => {
    if (chartRef.current) {
      // Convert from milliseconds to microseconds
      const timestampUs = selectedTimestamp ? selectedTimestamp * 1000 : null;
      chartRef.current.setSelectedTimestamp(timestampUs);
    }
  }, [selectedTimestamp]);

  // Update visible range indicators
  useEffect(() => {
    if (chartRef.current) {
      // Convert from milliseconds to microseconds
      const firstUs = visibleRange.first ? visibleRange.first * 1000 : null;
      const lastUs = visibleRange.last ? visibleRange.last * 1000 : null;
      chartRef.current.setVisibleRange(firstUs, lastUs, sortOrder);
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
        // Convert from microseconds to milliseconds
        const startMs = Math.floor(zoomRange[0] / 1000);
        const endMs = Math.ceil(zoomRange[1] / 1000);
        console.log('[LogsTimeline] handleSync - calling onTimeRangeChange with:', { startMs, endMs });
        onTimeRangeChange(startMs, endMs);
      }
    }
  }, [onTimeRangeChange]);

  // Debug: Log onTimeRangeChange availability
  useEffect(() => {
    console.log('[LogsTimeline] onTimeRangeChange prop:', !!onTimeRangeChange);
  }, [onTimeRangeChange]);

  return (
    <div className="logs-timeline" style={{ position: 'relative', height }}>
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
          className="timeline-icon-button"
          title="Recenter to full time range"
        >
          <Icon name="home-alt" size="sm" />
        </button>
        {onTimeRangeChange && (
          <button
            onClick={handleSync}
            className="timeline-icon-button"
            title="Update dashboard time range to match current view"
          >
            <Icon name="clock-nine" size="sm" />
          </button>
        )}
      </div>
    </div>
  );
};

export default LogsTimeline;
