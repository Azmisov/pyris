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
  /** Called when tooltip is clicked to reveal logs */
  onClick?: (position: 'left' | 'right') => void;
}

/**
 * Displays log counts outside the visible range at the top corners of the chart
 */
export const RangeInfoTooltip: React.FC<RangeInfoTooltipProps> = ({ info, position, onClick }) => {
  if (!info) {
    return null;
  }

  const count = position === 'left' ? info.before : info.after;

  // Don't show if count is 0
  if (count === 0) {
    return null;
  }

  const label = count === 1 ? 'log' : 'logs';

  const handleClick = () => {
    onClick?.(position);
  };

  return (
    <div
      className={`${styles.tooltip} ${position === 'left' ? styles.left : styles.right}`}
      title="Click to reveal logs"
      onClick={handleClick}
    >
      <div className={styles.content}>
        {count.toLocaleString()} {label}
      </div>
    </div>
  );
};
