import React from 'react';

interface EmptyStateProps {
  className?: string;
  width?: number;
  height?: number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  className = '',
  width,
  height,
}) => {
  return (
    <div className={`ansi-logs-panel ansi-empty ${className}`} style={{ width, height }}>
      <div className="ansi-empty-message">
        <h3>No log data</h3>
        <p>No logs available to display.</p>
      </div>
    </div>
  );
};
