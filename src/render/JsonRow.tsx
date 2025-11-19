import React, { memo, useMemo } from 'react';
import { JsonLogRow, LogsPanelOptions } from '../types';
import { formatJsonToAnsi } from '../utils/jsonFormatter';

interface JsonRowProps {
  row: JsonLogRow;
  options: LogsPanelOptions;
  isSelected?: boolean;
  onRowClick?: (row: JsonLogRow) => void;
  onRowHover?: (row: JsonLogRow | null) => void;
  style?: React.CSSProperties;
}

// Main JSON row component with memoization
export const JsonRow = memo<JsonRowProps>(({ row, options, isSelected, onRowClick, onRowHover, style }) => {
  // Format JSON with syntax highlighting
  const processedJson = useMemo(() => {
    return formatJsonToAnsi(row.data, {
      compact: !isSelected, // Compact when not selected, multi-line when selected
      depth: 0,
      indentSize: 2,
    });
  }, [row.data, isSelected]);

  const handleClick = useMemo(() => {
    return onRowClick ? () => onRowClick(row) : undefined;
  }, [onRowClick, row]);

  const handleMouseEnter = useMemo(() => {
    return onRowHover ? () => onRowHover(row) : undefined;
  }, [onRowHover, row]);

  const handleMouseLeave = useMemo(() => {
    return onRowHover ? () => onRowHover(null) : undefined;
  }, [onRowHover]);

  const className = useMemo(() => {
    const classes = ['json-row'];
    if (isSelected) classes.push('selected');
    if (row.level) classes.push(`level-${row.level.toLowerCase()}`);
    if (options.wrapMode === 'soft-wrap') classes.push('wrap-mode-soft');
    return classes.join(' ');
  }, [isSelected, row.level, options.wrapMode]);

  return (
    <div
      className={className}
      style={style}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {options.showLabels && row.labels && (
        <LabelsDisplay labels={row.labels} selectedLabels={options.selectedLabels} />
      )}
      <span
        className={isSelected ? 'json-content' : 'json-content compact'}
        dangerouslySetInnerHTML={{ __html: processedJson }}
      />
    </div>
  );
});

JsonRow.displayName = 'JsonLogsRow';

// Labels display component (same as ANSI row)
interface LabelsDisplayProps {
  labels: Record<string, string>;
  selectedLabels: string[];
}

const LabelsDisplay = memo<LabelsDisplayProps>(({ labels, selectedLabels }) => {
  const filteredLabels = useMemo(() => {
    if (selectedLabels.length === 0) {
      return labels;
    }

    const filtered: Record<string, string> = {};
    for (const key of selectedLabels) {
      if (labels[key] !== undefined) {
        filtered[key] = labels[key];
      }
    }
    return filtered;
  }, [labels, selectedLabels]);

  const labelEntries = useMemo(() => {
    return Object.entries(filteredLabels);
  }, [filteredLabels]);

  if (labelEntries.length === 0) {
    return null;
  }

  return (
    <span className="ansi-labels-container">
      {labelEntries.map(([key, value]) => (
        <span key={key} className="ansi-label-badge" title={`${key}=${value}`}>
          {key}={value}
        </span>
      ))}
    </span>
  );
});

LabelsDisplay.displayName = 'LabelsDisplay';
