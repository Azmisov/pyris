import React, { memo, useMemo } from 'react';
import { AnsiLogRow, ProcessedLogRow, LogsPanelOptions } from '../types';
import { ansiToHtml, hasAnsiCodes, truncateLine, stripAnsiCodes } from '../converters/ansi';
import { linkifyPlainUrls } from '../converters/urlDetector';
import { createMemoKey, getGlobalCache } from '../utils/memo';

interface RowProps {
  row: AnsiLogRow;
  options: LogsPanelOptions;
  isSelected?: boolean;
  onRowClick?: (row: AnsiLogRow) => void;
  onRowHover?: (row: AnsiLogRow | null) => void;
  style?: React.CSSProperties;
}

// Main row component with memoization
export const Row = memo<RowProps>(({ row, options, isSelected, onRowClick, onRowHover, style }) => {
  // Process the row with caching
  const processedRow = useMemo(() => {
    return processLogRow(row, options);
  }, [row.message, row.id, options.maxLineLength, options.wrapMode]);

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
    const classes = ['ansi-logs-row'];
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
      {/* Wrapper span is required: React doesn't allow dangerouslySetInnerHTML
          on elements that have other React children (like LabelsDisplay above) */}
      <span
        dangerouslySetInnerHTML={{ __html: processedRow.html }}
      />
    </div>
  );
});

Row.displayName = 'AnsiLogsRow';

// Labels display component
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

// Process log row with caching
function processLogRow(row: AnsiLogRow, options: LogsPanelOptions): ProcessedLogRow {
  const cache = getGlobalCache();
  const cacheKey = createMemoKey(row.message, options);

  // Check cache first
  const cached = cache.getWithStats(cacheKey);
  if (cached) {
    return cached;
  }

  // Process the message
  const message = row.message || '';
  const hasAnsi = hasAnsiCodes(message);

  // Always strip ANSI codes for searching
  const strippedText = stripAnsiCodes(message);

  let html: string;

  if (!hasAnsi) {
    // Fast path: plain text
    html = escapeHtml(message);
  } else {
    // Convert ANSI to HTML (includes OSC-8 hyperlink processing)
    html = ansiToHtml(message);
  }

  // Apply plain URL detection (auto-linking, dangerous schemes are blocked internally)
  const withPlainLinks = linkifyPlainUrls(html, []);
  if (withPlainLinks !== html) {
    html = withPlainLinks;
  }

  // Apply line truncation if needed
  if (options.wrapMode === 'nowrap' && options.maxLineLength > 0) {
    html = truncateLine(html, options.maxLineLength);
  }

  const processed: ProcessedLogRow = {
    ...row,
    html,
    strippedText,
  };

  // Cache the result
  cache.set(cacheKey, processed);

  return processed;
}

// Simple HTML escaping for plain text
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}