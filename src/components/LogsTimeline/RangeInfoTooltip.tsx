import React from 'react';
import styles from './RangeInfoTooltip.module.css';

export interface RangeInfo {
  /** Number of logs before the visible range */
  before: number;
  /** Number of logs after the visible range */
  after: number;
}

interface RangeInfoTooltipProps {
  info: RangeInfo | null;
  /** Position: 'left' or 'right' */
  position: 'left' | 'right';
}

/**
 * Displays log counts outside the visible range at the top corners of the chart
 */
export const RangeInfoTooltip: React.FC<RangeInfoTooltipProps> = ({ info, position }) => {
  if (!info) {
    return null;
  }

  const count = position === 'left' ? info.before : info.after;

  // Don't show if count is 0
  if (count === 0) {
    return null;
  }

  const label = count === 1 ? 'log' : 'logs';

  return (
    <div
      className={`${styles.tooltip} ${position === 'left' ? styles.left : styles.right}`}
      style={{
        position: 'absolute',
        top: 8,
        [position]: 8,
        pointerEvents: 'none',
      }}
    >
      <div className={styles.content}>
        {count.toLocaleString()} {label}
      </div>
    </div>
  );
};
