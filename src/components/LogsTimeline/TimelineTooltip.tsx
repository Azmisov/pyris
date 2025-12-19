import React, { useRef, useState, useLayoutEffect } from 'react';
import { dateTimeParse } from '@grafana/data';
import { TooltipData } from './TimelineChart';
import { IndicatorType, VerticalIndicator } from './VerticalIndicator';
import styles from './TimelineTooltip.module.css';

/** Convert indicator to display label based on type and direction */
function getIndicatorLabel(indicator: VerticalIndicator): string {
  const type = indicator.getType();
  const direction = indicator.getDirection();

  let label: string;
  switch (type) {
    case IndicatorType.Selected:
      return 'Selected log';
    case IndicatorType.Visible:
      label = 'Visible logs';
      break;
    case IndicatorType.Dashboard:
      label = 'Dashboard range';
      break;
    default:
      return '';
  }

  return label + (direction === 'right' ? ' start' : ' end');
}

interface TimelineTooltipProps {
  data: TooltipData;
  containerWidth: number;
  timeZone?: string;
}

const EDGE_PADDING = -2; // Tooltip extends past edge to hide border
const LEFT_TRIANGLE_OFFSET = 9; // Offset when triangle points left
const RIGHT_TRIANGLE_OFFSET = 10; // Offset when triangle points right

/**
 * Format a timestamp with timezone information
 * Returns formatted time string and timezone label (with offset if not UTC)
 */
function formatTimeWithTz(
  timestamp: number,
  tz: string | undefined,
  browserTz: string
): { time: string; tzLabel: string } {
  const dt = dateTimeParse(timestamp, { timeZone: tz });
  const time = dt.format('ddd YYYY-MM-DD HH:mm:ss.SSS');

  // Determine timezone label
  const tzName = tz === 'utc' ? 'UTC'
    : tz === 'browser' || !tz ? browserTz
    : tz;

  // Add offset if not UTC
  const offset = tzName !== 'UTC' ? ` (${dt.format('Z')})` : '';
  const tzLabel = `${tzName}${offset}`;

  return { time, tzLabel };
}

type TriangleDirection = 'top' | 'left' | 'right';

export const TimelineTooltip: React.FC<TimelineTooltipProps> = ({ data, containerWidth, timeZone }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  // Measure tooltip width after render
  useLayoutEffect(() => {
    if (contentRef.current) {
      setTooltipWidth(contentRef.current.offsetWidth);
    }
  }, [data]);

  // Determine if timestamp is off-screen and which direction
  const isOffLeft = data.x < 0;
  const isOffRight = data.x > containerWidth;
  const triangleDirection: TriangleDirection = isOffLeft ? 'left' : isOffRight ? 'right' : 'top';

  // Calculate clamped position and triangle offset
  const halfWidth = tooltipWidth / 2;
  const minX = halfWidth + EDGE_PADDING;
  const maxX = containerWidth - halfWidth - EDGE_PADDING;

  let clampedX: number;
  let triangleOffset = 0;

  if (isOffLeft) {
    // Position tooltip at left edge, with room for side triangle
    clampedX = minX + LEFT_TRIANGLE_OFFSET;
  } else if (isOffRight) {
    // Position tooltip at right edge, with room for side triangle
    clampedX = maxX - RIGHT_TRIANGLE_OFFSET;
  } else {
    // Normal behavior - clamp within bounds and calculate triangle offset
    clampedX = tooltipWidth > 0
      ? Math.max(minX, Math.min(maxX, data.x))
      : data.x; // Use unclamped position until width is measured
    triangleOffset = data.x - clampedX; // How far the triangle needs to shift from center
  }

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Format primary timezone
  const primary = formatTimeWithTz(data.timestamp, timeZone, browserTz);

  // Format secondary timezone (opposite of primary: UTC <-> browser)
  const secondaryTz = timeZone === 'utc' ? 'browser' : 'utc';
  const secondary = formatTimeWithTz(data.timestamp, secondaryTz, browserTz);

  // Only show secondary timezone if it differs from primary
  const showSecondary = primary.tzLabel !== secondary.tzLabel;

  const labeledIndicators = data.indicators.filter(ind => getIndicatorLabel(ind) !== '');
  const hasDetails = labeledIndicators.length > 0 || data.beyondLogs || data.beyondVisible || data.beyondDashboard || data.bin !== null;

  return (
    <div
      className={styles.tooltip}
      style={{
        position: 'absolute',
        left: clampedX,
        bottom: 0,
        transform: 'translate(-50%, 100%)',
        pointerEvents: 'none',
        // Pass triangle offset as CSS variable
        '--triangle-offset': `${triangleOffset}px`,
      } as React.CSSProperties}
    >
      <div ref={contentRef} className={`${styles.content} ${styles[triangleDirection]}`}>
        <div className={styles.primary}>
          {primary.time}
          <span className={styles.tz}> {primary.tzLabel}</span>
        </div>
        {showSecondary && (
          <div className={styles.secondary}>
            {secondary.time} {secondary.tzLabel}
          </div>
        )}
        {hasDetails && (
          // ordered from most stable to least stable when moving mouse
          <div className={styles.details}>
            {data.beyondLogs && (
              <div className={styles.beyond}>
                Beyond log data
              </div>
            )}
            {data.beyondVisible && !data.beyondLogs && (
              <div className={styles.beyond}>
                Beyond visible logs
              </div>
            )}
            {data.beyondDashboard && (
              <div className={styles.beyond}>
                Beyond dashboard range
              </div>
            )}
            {labeledIndicators.map((indicator, i) => (
              <div
                key={i}
                className={styles.indicator}
                style={{ color: indicator.getColor() }}
              >
                {getIndicatorLabel(indicator)}
              </div>
            ))}
            {data.bin && (
              <div className={`${styles.indicator} ${styles.count}`}>
                {data.filteredBin ? (
                  <>
                    <span className={styles.filtered}>{data.filteredBin.count}</span>
                    {' of '}
                  </>
                ) : null}
                {data.bin.count} {data.bin.count === 1 ? 'log' : 'logs'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
