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

export const TimelineTooltip: React.FC<TimelineTooltipProps> = ({ data, containerWidth, timeZone }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  // Measure tooltip width after render
  useLayoutEffect(() => {
    if (contentRef.current) {
      setTooltipWidth(contentRef.current.offsetWidth);
    }
  }, [data]);

  // Calculate clamped position and triangle offset
  const halfWidth = tooltipWidth / 2;
  const minX = halfWidth + EDGE_PADDING;
  const maxX = containerWidth - halfWidth - EDGE_PADDING;
  const clampedX = tooltipWidth > 0
    ? Math.max(minX, Math.min(maxX, data.x))
    : data.x; // Use unclamped position until width is measured
  const triangleOffset = data.x - clampedX; // How far the triangle needs to shift from center
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const primaryDt = dateTimeParse(data.timestamp, { timeZone });
  const primaryTime = primaryDt.format('ddd YYYY-MM-DD HH:mm:ss.SSS');
  const primaryOffset = primaryDt.format('Z');
  const tzLabel = timeZone === 'utc' ? 'UTC'
    : timeZone === 'browser' || !timeZone ? browserTz
    : timeZone;

  const isUtc = timeZone === 'utc';
  const secondaryTz = isUtc ? 'browser' : 'utc';
  const secondaryDt = dateTimeParse(data.timestamp, { timeZone: secondaryTz });
  const secondaryTime = secondaryDt.format('ddd YYYY-MM-DD HH:mm:ss.SSS');
  const secondaryOffset = secondaryDt.format('Z');
  const secondaryLabel = isUtc ? browserTz : 'UTC';

  const labeledIndicators = data.indicators.filter(ind => getIndicatorLabel(ind) !== '');
  const hasDetails = labeledIndicators.length > 0 || data.beyondLogs || data.beyondVisible || data.beyondDashboard;

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
      <div ref={contentRef} className={styles.content}>
        <div className={styles.primary}>
          {primaryTime}
          <span className={styles.tz}> {tzLabel} ({primaryOffset})</span>
        </div>
        <div className={styles.secondary}>
          {secondaryTime} {secondaryLabel}{!isUtc ? '' : ` (${secondaryOffset})`}
        </div>
        {hasDetails && (
          <div className={styles.details}>
            {labeledIndicators.map((indicator, i) => (
              <div
                key={i}
                className={styles.indicator}
                style={{ color: indicator.getColor() }}
              >
                {getIndicatorLabel(indicator)}
              </div>
            ))}
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
          </div>
        )}
      </div>
    </div>
  );
};
