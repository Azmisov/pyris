import React from 'react';
import styles from './ErrorState.module.css';

interface ErrorStateProps {
  error: string;
  onDismiss: () => void;
  className?: string;
  width?: number;
  height?: number;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  onDismiss,
  className = '',
  width,
  height,
}) => {
  return (
    <div className={`${styles.panel} ${className}`} style={{ width, height }}>
      <div className={styles.container}>
        <div className={styles.message}>
          <h3>Error loading logs</h3>
          <p>{error}</p>
          <button onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  );
};
