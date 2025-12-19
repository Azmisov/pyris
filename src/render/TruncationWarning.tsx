import React, { memo } from 'react';
import { Icon } from '@grafana/ui';
import styles from './TruncationWarning.module.css';

export interface TruncationWarningProps {
  /** Type of truncation warning */
  type: 'row-count';
  /** Number of rows being shown */
  displayedCount: number;
  /** Total number of rows */
  totalCount: number;
}

/**
 * Warning component for row count truncation.
 * Displayed as the first row when there are more logs than maxRenderableRows.
 * Line-level truncation is shown inline at the end of each truncated row.
 */
export const TruncationWarning = memo<TruncationWarningProps>(({
  type,
  displayedCount,
  totalCount,
}) => {
  if (type === 'row-count') {
    const hiddenCount = totalCount - displayedCount;
    return (
      <div className={styles.warning}>
        <Icon name="exclamation-triangle" className={styles.icon} />
        <span>
          Truncated {hiddenCount.toLocaleString()} oldest logs: Copy to view all
        </span>
      </div>
    );
  }

  return null;
});

TruncationWarning.displayName = 'TruncationWarning';
