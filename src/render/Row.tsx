import React, { memo, useCallback, useMemo } from 'react';
import { AnsiLogRow, ProcessedLogRow, LogsPanelOptions } from '../types';
import { convertAnsiToHtml, stripAnsiCodes } from '../converters/ansi';
import { createMemoKey, getGlobalCache } from '../utils/memo';
import { useCopyToast } from '../components/CopyableValue';
import styles from './Row.module.css';
import sharedStyles from '../shared.module.css';
import ansi from '../theme/ansi.module.css';

const linkClass = ansi['logs-detected-link'];
// `styles.rowCopyable` is a space-separated list because of `composes` in the
// CSS module — use the full string when adding to className for styling, but
// take the first token for DOM selectors (a multi-token selector string becomes
// a descendant combinator, which `closest()` can't satisfy on a single span).
const copyableClass = styles.rowCopyable;
const copyableSelectorClass = copyableClass.split(/\s+/).filter(Boolean)[0];

const MATCHING_QUOTES = new Set(['"', '\'', '`']);

// Clean up text copied from a copyable span:
function cleanCopyText(text: string): string {
  let s = text.trim();
  // punctuation + whitespace at start or end; likely indicates separators between styled content
  s = s.replace(/\s+[\p{P}\p{S}]+$/u, '');
  s = s.replace(/^[\p{P}\p{S}]+\s+/u, '');
  // key=value separators
  s = s.replace(/[=:]$/, '');
  // Strip matching wrapping quotes (e.g., 'foo' → foo, "bar" → bar).
  // Mismatched brackets like [foo 'bar'] are left alone.
  if (s.length >= 2 && s[0] === s[s.length - 1] && MATCHING_QUOTES.has(s[0])) {
    s = s.slice(1, -1);
  }
  return s;
}

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

  const { copyWithToast, Toast } = useCopyToast();

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    // Only enable copy-on-click when the row is already selected — same
    // interaction model as JsonRow (copyEnabled={isSelected}). An unselected
    // row's click should fall through to the row-level handler, selecting it.
    if (!isSelected) {return;}
    const target = e.target as HTMLElement;
    if (!target) {return;}
    // Let clicks on detected / OSC-8 links fall through to the link-modal logic.
    if (target.closest('a')) {return;}
    const copyableEl = target.closest(`.${copyableSelectorClass}`) as HTMLElement | null;
    if (!copyableEl) {return;}
    e.stopPropagation();
    const text = cleanCopyText(copyableEl.textContent || '');
    if (!text) {return;}
    copyWithToast(text, e);
  }, [isSelected, copyWithToast]);

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
        <LabelsDisplay labels={row.labels} selectedLabels={options.selectedLabels} blockMode={isSelected || options.wrapMode === 'soft-wrap'} />
      )}
      {/* Wrapper span is required: React doesn't allow dangerouslySetInnerHTML
          on elements that have other React children (like LabelsDisplay above) */}
      <span
        onClick={handleContentClick}
        dangerouslySetInnerHTML={{ __html: processedRow.html }}
      />
      {processedRow.truncatedChars !== undefined && processedRow.truncatedChars > 0 && (
        <span className={styles.truncationIndicator} title={`${processedRow.truncatedChars.toLocaleString()} characters truncated. Copy to view full line.`}>
          +{processedRow.truncatedChars.toLocaleString()}
        </span>
      )}
      {Toast}
    </div>
  );
});

Row.displayName = 'AnsiLogsRow';

// Labels display component
interface LabelsDisplayProps {
  labels: Record<string, string>;
  selectedLabels: string[];
  blockMode?: boolean;
}

const LabelsDisplay = memo<LabelsDisplayProps>(({ labels, selectedLabels, blockMode }) => {
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

  const containerClass = blockMode
    ? `${sharedStyles.labelsContainer} ${sharedStyles.labelsContainerBlock}`
    : sharedStyles.labelsContainer;

  return (
    <span className={containerClass}>
      {labelEntries.map(([key, value]) => (
        <span key={key} className={sharedStyles.labelBadge}>
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

  // Always strip ANSI codes for searching
  const strippedText = stripAnsiCodes(message);

  // Determine max length for truncation (applies in both wrap modes)
  const maxLength = options.maxLineLength > 0 ? options.maxLineLength : undefined;

  // ANSI → HTML in one pass: SGR styling, OSC-8 hyperlinks, plain-URL
  // auto-linking, and copyable-class marking. Handles pure plain text fine
  // (the parser yields a single TEXT token and the row gets URL linkification
  // but no copyable class, since no SGR codes are present).
  const { html, truncatedChars } = convertAnsiToHtml(message, ansi, linkClass, maxLength, copyableClass);

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

