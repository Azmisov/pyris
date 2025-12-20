/**
 * LogsTimeline component
 * Displays a timeline view of log distribution with zoom/pan controls
 */

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Icon } from '@grafana/ui';
import { TimelineChart, TooltipData, RangeInfo } from './TimelineChart';
import { TimelineTooltip } from './TimelineTooltip';
import { RangeInfoTooltip } from './RangeInfoTooltip';
import { AnsiLogRow } from '../../types';
import { ColorScheme } from '../../theme/colorSchemes';
import styles from './index.module.css';

interface LogsTimelineProps {
  logs: AnsiLogRow[];
  /** Filtered logs subset (when filter is active) */
  filteredLogs?: AnsiLogRow[];
  height?: number;
  hoveredTimestamp?: number | null;
  selectedTimestamp?: number | null;
  visibleRange?: { first: number | null; last: number | null };
  colorScheme: ColorScheme;
  onTimeRangeChange?: (startTime: number, endTime: number) => void;
  onLogSelect?: (timestamp: number) => void;
  /** Called when timeline hover changes (for cursor sync) */
  onHoverChange?: (timestamp: number | null) => void;
  dashboardTimeRange?: { from: number; to: number };
  fontFamily?: string;
  timeZone?: string;
  /** True if hoveredTimestamp is from external event (shared tooltip) */
  isExternalHover?: boolean;
}

const DEFAULT_HEIGHT = 100;

export const LogsTimeline: React.FC<LogsTimelineProps> = ({
  logs,
  filteredLogs,
  height = DEFAULT_HEIGHT,
  hoveredTimestamp = null,
  selectedTimestamp = null,
  visibleRange = { first: null, last: null },
  colorScheme,
  onTimeRangeChange,
  onLogSelect,
  onHoverChange,
  dashboardTimeRange,
  fontFamily,
  timeZone,
  isExternalHover = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<TimelineChart | null>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [rangeInfo, setRangeInfo] = useState<RangeInfo | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  // Track if mouse is in the timeline (for determining when to show external tooltip)
  const isLocalHoverRef = useRef(false);
  // Track if we're currently showing an external tooltip (to know when to clear it)
  const isShowingExternalTooltipRef = useRef(false);

  // Track container width for tooltip clamping
  useEffect(() => {
    if (!containerRef.current) {return;}
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    // Set initial width
    setContainerWidth(containerRef.current.offsetWidth);
    return () => observer.disconnect();
  }, []);

  // Extract timestamps from logs
  const timestamps = useMemo(() => {
    return logs.map(log => log.timestamp);
  }, [logs]);

  // Extract filtered timestamps (when filter is active)
  const filteredTimestamps = useMemo(() => {
    return filteredLogs?.map(log => log.timestamp);
  }, [filteredLogs]);

  // Initialize chart (only once)
  useEffect(() => {
    if (!containerRef.current) {return;}

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

  // Set range info callback
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setOnRangeInfo(setRangeInfo);
    }
  }, []);

  // Track local hover via mouse events on container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {return;}

    const handleMouseEnter = () => {
      isLocalHoverRef.current = true;
    };
    const handleMouseLeave = () => {
      isLocalHoverRef.current = false;
    };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Notify parent of hover changes (for cursor sync)
  // Only notify for local hovers, not for external tooltips (to avoid feedback loop)
  useEffect(() => {
    if (onHoverChange && isLocalHoverRef.current) {
      onHoverChange(tooltipData?.timestamp ?? null);
    }
  }, [tooltipData, onHoverChange]);

  // Set initial zoom to dashboard range on first load
  const hasSetInitialZoom = useRef(false);
  useEffect(() => {
    if (chartRef.current && dashboardTimeRange && !hasSetInitialZoom.current) {
      chartRef.current.setInitialZoom([dashboardTimeRange.from, dashboardTimeRange.to]);
      hasSetInitialZoom.current = true;
    }
  }, [dashboardTimeRange]);

  // Update chart data when logs change
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setData(timestamps);
    }
  }, [timestamps]);

  // Update filtered data separately (avoids rebuilding main index on filter change)
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setFilteredData(filteredTimestamps);
    }
  }, [filteredTimestamps]);

  // Update dashboard time range indicators
  useEffect(() => {
    if (chartRef.current && dashboardTimeRange) {
      chartRef.current.setDashboardRange(dashboardTimeRange.from, dashboardTimeRange.to);
    }
  }, [dashboardTimeRange]);

  // Update hovered timestamp and show external tooltip (shared tooltip feature)
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setHoveredTimestamp(hoveredTimestamp ?? null);

      // Only show tooltip for external hovers when mouse is not in the timeline
      const shouldShowExternalTooltip = isExternalHover && hoveredTimestamp !== null && !isLocalHoverRef.current;

      if (shouldShowExternalTooltip) {
        chartRef.current.showTooltipAtTimestamp(hoveredTimestamp);
        isShowingExternalTooltipRef.current = true;
      } else if (isShowingExternalTooltipRef.current) {
        // Clear external tooltip when:
        // - hover ends (hoveredTimestamp is null)
        // - hover becomes internal (isExternalHover is false)
        // - mouse enters timeline (isLocalHoverRef.current is true, local tooltip takes over)
        chartRef.current.showTooltipAtTimestamp(null);
        isShowingExternalTooltipRef.current = false;
      }
    }
  }, [hoveredTimestamp, isExternalHover]);

  // Update selected timestamp
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setSelectedTimestamp(selectedTimestamp ?? null);
    }
  }, [selectedTimestamp]);

  // Update visible range indicators
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setVisibleRange(visibleRange.first ?? null, visibleRange.last ?? null);
    }
  }, [visibleRange]);

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

  // Range info tooltip click handler (expands zoom to reveal logs)x
  const handleTooltipClick = useCallback((position: 'left' | 'right') => {
    if (chartRef.current) {
      chartRef.current.expandZoomToRevealLogs(position);
    }
  }, []);

  return (
    <div className={styles.timeline} style={{ position: 'relative', height }}>
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
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '5px',
        }}
      >
        <button
          onClick={handleRecenter}
          className={styles.iconButton}
          title="Center view to log's time range"
        >
          <Icon name="home-alt" />
        </button>
        {onTimeRangeChange && (
          <button
            onClick={handleSync}
            className={styles.iconButton}
            title="Update dashboard time range to match current view"
          >
            <Icon name="clock-nine" />
          </button>
        )}
      </div>
      {tooltipData && <TimelineTooltip data={tooltipData} containerWidth={containerWidth} timeZone={timeZone} />}
      <RangeInfoTooltip info={rangeInfo} position="left" onClick={handleTooltipClick} />
      <RangeInfoTooltip info={rangeInfo} position="right" onClick={handleTooltipClick} />
    </div>
  );
};

export default LogsTimeline;
