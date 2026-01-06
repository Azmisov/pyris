import React, { memo, useMemo } from 'react';
import { AnsiLogRow, ProcessedLogRow, LogsPanelOptions } from '../types';
import { convertAnsiToHtml, hasAnsiCodes, stripAnsiCodes } from '../converters/ansi';
import { linkifyPlainUrls } from '../converters/urlDetector';
import { createMemoKey, getGlobalCache } from '../utils/memo';
import styles from './Row.module.css';

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
  // Intentionally using specific properties to avoid unnecessary recomputation
  /* eslint-disable react-hooks/exhaustive-deps */
  const processedRow = useMemo(() => {
    return processLogRow(row, options);
  }, [row.message, row.id, options.maxLineLength, options.wrapMode]);
  /* eslint-enable react-hooks/exhaustive-deps */

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
    const classes = [styles.logsRow];
    if (isSelected) {classes.push(styles.selected);}
    if (row.level) {classes.push(`level-${row.level.toLowerCase()}`);}
    if (options.wrapMode === 'soft-wrap') {classes.push(styles.wrapModeSoft);}
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
      {processedRow.truncatedChars !== undefined && processedRow.truncatedChars > 0 && (
        <span className={styles.truncationIndicator} title={`${processedRow.truncatedChars.toLocaleString()} characters truncated. Copy to view full line.`}>
          +{processedRow.truncatedChars.toLocaleString()}
        </span>
      )}
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
    <span className={styles.labelsContainer}>
      {labelEntries.map(([key, value]) => (
        <span key={key} className={styles.labelBadge} title={`${key}=${value}`}>
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

  // Determine max length for truncation (applies in both wrap modes)
  const maxLength = options.maxLineLength > 0 ? options.maxLineLength : undefined;

  let html: string;
  let truncatedChars = 0;

  if (!hasAnsi) {
    // Fast path: plain text - apply truncation directly
    if (maxLength && message.length > maxLength) {
      html = escapeHtml(message.substring(0, maxLength)) + '…';
      truncatedChars = message.length - maxLength;
    } else {
      html = escapeHtml(message);
    }
  } else {
    // Convert ANSI to HTML with truncation (includes OSC-8 hyperlink processing)
    // The conversion stops early when maxLength is reached and properly closes tags
    const result = convertAnsiToHtml(message, maxLength);
    html = result.html;
    truncatedChars = result.truncatedChars;
  }

  // Apply plain URL detection (auto-linking, dangerous schemes are blocked internally)
  // Only apply to non-truncated content to avoid linkifying partial URLs
  if (truncatedChars === 0) {
    const withPlainLinks = linkifyPlainUrls(html, []);
    if (withPlainLinks !== html) {
      html = withPlainLinks;
    }
  }

  const processed: ProcessedLogRow = {
    ...row,
    html,
    strippedText,
    truncatedChars,
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
