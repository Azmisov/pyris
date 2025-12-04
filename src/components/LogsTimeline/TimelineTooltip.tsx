import React from 'react';
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
  timeZone?: string;
}

export const TimelineTooltip: React.FC<TimelineTooltipProps> = ({ data, timeZone }) => {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const primaryDt = dateTimeParse(data.timestamp, { timeZone });
  const primaryTime = primaryDt.format('YYYY-MM-DD HH:mm:ss.SSS');
  const primaryOffset = primaryDt.format('Z');
  const tzLabel = timeZone === 'utc' ? 'UTC'
    : timeZone === 'browser' || !timeZone ? browserTz
    : timeZone;

  const isUtc = timeZone === 'utc';
  const secondaryTz = isUtc ? 'browser' : 'utc';
  const secondaryDt = dateTimeParse(data.timestamp, { timeZone: secondaryTz });
  const secondaryTime = secondaryDt.format('YYYY-MM-DD HH:mm:ss.SSS');
  const secondaryOffset = secondaryDt.format('Z');
  const secondaryLabel = isUtc ? browserTz : 'UTC';

  const labeledIndicators = data.indicators.filter(ind => getIndicatorLabel(ind) !== '');
  const hasDetails = labeledIndicators.length > 0 || data.beyondVisible || data.beyondDashboard;

  return (
    <div
      className={styles.tooltip}
      style={{
        position: 'absolute',
        left: data.x,
        top: 0,
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
      }}
    >
      <div className={styles.content}>
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
            {data.beyondVisible && (
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
