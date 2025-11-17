import React from 'react';

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
    <div className={`ansi-logs-panel ansi-error ${className}`} style={{ width, height }}>
      <div className="ansi-error-message">
        <h3>Error loading logs</h3>
        <p>{error}</p>
        <button onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
};
