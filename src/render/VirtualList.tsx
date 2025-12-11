import React, { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import AutoSizer from 'react-virtualized-auto-sizer';
import { AnsiLogRow, LogRow, LogsPanelOptions } from '../types';
import { Row } from './Row';
import { JsonRow } from './JsonRow';
import { applyFontSizeVars } from '../utils/fontSizing';

interface VirtualListProps {
  rows: LogRow[];
  options: LogsPanelOptions;
  height: number;
  width: number;
  onRowClick?: (row: LogRow, index: number) => void;
  onRowHover?: (row: LogRow | null, index: number | null) => void;
  onVisibleRangeChange?: (firstRow: LogRow | null, lastRow: LogRow | null, startIndex: number, endIndex: number) => void;
  selectedIndex?: number;
  onScroll?: (scrollOffset: number) => void;
  sortOrder?: 'asc' | 'desc';
  scrollToIndex?: { index: number; timestamp: number; behavior?: 'smooth' | 'auto'; align?: 'start' | 'center' | 'end' };
  expandedPaths?: Set<string>;
  onToggleExpand?: (path: string | string[]) => void;
}

export const VirtualList = memo<VirtualListProps>(({
  rows,
  options,
  height,
  width,
  onRowClick,
  onRowHover,
  onVisibleRangeChange,
  selectedIndex,
  onScroll,
  sortOrder = 'asc',
  scrollToIndex,
  expandedPaths,
  onToggleExpand
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const virtuosoRef = useRef<any>(null);

  // With line-height: normal, rows are naturally ~1.2-1.3x font-size
  // For 14px font: ~18px height
  const itemHeight = options.rowHeight === 'fixed' ? options.fixedRowHeight : 18;
  const maxRows = Math.min(rows.length, options.maxRenderableRows);

  // Rows are already in ascending order from LogsViewer
  // Just reverse for desc display
  const displayRows = useMemo(() => {
    let displayRows = rows;
    let desc = sortOrder == 'desc';
    if (rows.length > maxRows || desc) {
      displayRows = rows.slice(0, maxRows);
      if (desc) {
        displayRows.reverse();
      }
    }
    return displayRows;
  }, [rows, maxRows, sortOrder]);

  // Map display index to logical index (ascending order index)
  const displayToLogical = useCallback((displayIndex: number): number => {
    if (sortOrder === 'desc') {
      return displayRows.length - 1 - displayIndex;
    }
    return displayIndex;
  }, [sortOrder, displayRows.length]);

  // Map logical index to display index
  const logicalToDisplay = useCallback((logicalIndex: number): number => {
    if (sortOrder === 'desc') {
      return displayRows.length - 1 - logicalIndex;
    }
    return logicalIndex;
  }, [sortOrder, displayRows.length]);

  const renderItem = useCallback((displayIndex: number, row: LogRow) => {
    const logicalIndex = displayToLogical(displayIndex);
    const handleClick = onRowClick ? () => onRowClick(row, logicalIndex) : undefined;
    const handleHover = onRowHover ? (hoveredRow: LogRow | null) => onRowHover(hoveredRow, hoveredRow ? logicalIndex : null) : undefined;

    // Render JSON row
    if ('data' in row) {
      return (
        <JsonRow
          row={row}
          index={logicalIndex}
          options={options}
          isSelected={selectedIndex === logicalIndex}
          expandedPaths={expandedPaths}
          onRowClick={handleClick}
          onRowHover={handleHover}
          onToggleExpand={onToggleExpand}
        />
      );
    }

    // Render ANSI row
    if ('message' in row) {
      return (
        <Row
          row={row as AnsiLogRow}
          options={options}
          isSelected={selectedIndex === logicalIndex}
          onRowClick={handleClick}
          onRowHover={handleHover}
        />
      );
    }

    // Fallback for invalid row type
    return <div>Invalid row type</div>;
  }, [options, selectedIndex, onRowClick, onRowHover, expandedPaths, onToggleExpand, displayToLogical]);

  // Handle visible range changes - convert display indices to logical indices
  const handleRangeChanged = useCallback((range: { startIndex: number; endIndex: number }) => {
    if (!onVisibleRangeChange) return;

    const firstRow = displayRows[range.startIndex] || null;
    const lastRow = displayRows[range.endIndex] || null;
    const logicalStartIndex = displayToLogical(range.startIndex);
    const logicalEndIndex = displayToLogical(range.endIndex);
    onVisibleRangeChange(firstRow, lastRow, logicalStartIndex, logicalEndIndex);
  }, [displayRows, onVisibleRangeChange, displayToLogical]);

  // Apply font sizing CSS variables when row height or font family changes
  useEffect(() => {
    if (containerRef.current) {
      applyFontSizeVars(containerRef.current, itemHeight, options.fontFamily);
    }
  }, [itemHeight, options.fontFamily]);

  // Handle scrollToIndex - convert logical index to display index
  useEffect(() => {
    if (scrollToIndex && virtuosoRef.current) {
      const displayIndex = logicalToDisplay(scrollToIndex.index);
      virtuosoRef.current.scrollToIndex({
        index: displayIndex,
        align: scrollToIndex.align || 'center',
        behavior: scrollToIndex.behavior || 'smooth',
      });
    }
  }, [scrollToIndex, logicalToDisplay]);

  // Configure initial scroll position based on sort order
  // Both modes now start at the "newest" logs position in their respective arrays
  const initialIndex = sortOrder === 'asc'
    ? (displayRows.length > 0 ? displayRows.length - 1 : 0)  // Bottom (newest at end)
    : 0;  // Top (newest at start after reverse)

  // Compute className based on wrap mode
  const virtualListClassName = useMemo(() => {
    const classes = ['ansi-virtual-list'];
    if (options.wrapMode === 'soft-wrap') {
      classes.push('wrap-mode-enabled');
    }
    return classes.join(' ');
  }, [options.wrapMode]);

  return (
    <div ref={containerRef} className="ansi-logs-container" style={{ height, width }}>
      <Virtuoso
        ref={virtuosoRef}
        data={displayRows}
        totalCount={displayRows.length}
        itemContent={renderItem}
        style={{ height, width }}
        initialTopMostItemIndex={initialIndex}
        followOutput={sortOrder === 'asc' ? 'smooth' : false}
        rangeChanged={handleRangeChanged}
        className={virtualListClassName}
        components={{
          Header: () => <div style={{ height: 6 }} />,
        }}
      />
      {rows.length > options.maxRenderableRows && (
        <div className="ansi-truncation-notice">
          Showing {options.maxRenderableRows} of {rows.length} rows
        </div>
      )}
    </div>
  );
});

VirtualList.displayName = 'VirtualList';

// Auto-sizing wrapper component
interface AutoSizedVirtualListProps {
  rows: LogRow[];
  options: LogsPanelOptions;
  onRowClick?: (row: LogRow, index: number) => void;
  onRowHover?: (row: LogRow | null, index: number | null) => void;
  onVisibleRangeChange?: (firstRow: LogRow | null, lastRow: LogRow | null, startIndex: number, endIndex: number) => void;
  selectedIndex?: number;
  onScroll?: (scrollOffset: number) => void;
  minHeight?: number;
  sortOrder?: 'asc' | 'desc';
  scrollToIndex?: { index: number; timestamp: number; behavior?: 'smooth' | 'auto'; align?: 'start' | 'center' | 'end' };
  expandedPaths?: Set<string>;
  onToggleExpand?: (path: string | string[]) => void;
}

export const AutoSizedVirtualList = memo<AutoSizedVirtualListProps>(({
  rows,
  options,
  onRowClick,
  onRowHover,
  onVisibleRangeChange,
  selectedIndex,
  onScroll,
  minHeight = 200,
  sortOrder = 'asc',
  scrollToIndex,
  expandedPaths,
  onToggleExpand
}) => {
  return (
    <div className="ansi-auto-sized-container" style={{ height: '100%', minHeight }}>
      <AutoSizer>
        {({ height, width }: { height: number; width: number }) => (
          <VirtualList
            rows={rows}
            options={options}
            height={height}
            width={width}
            onRowClick={onRowClick}
            onRowHover={onRowHover}
            onVisibleRangeChange={onVisibleRangeChange}
            selectedIndex={selectedIndex}
            onScroll={onScroll}
            sortOrder={sortOrder}
            scrollToIndex={scrollToIndex}
            expandedPaths={expandedPaths}
            onToggleExpand={onToggleExpand}
          />
        )}
      </AutoSizer>
    </div>
  );
});

AutoSizedVirtualList.displayName = 'AutoSizedVirtualList';


// Search and filter utilities
export interface SearchOptions {
  caseSensitive?: boolean;
  useRegex?: boolean;
}

export function useVirtualListSearch(rows: AnsiLogRow[], options: SearchOptions = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredIndices, setFilteredIndices] = useState<number[]>([]);
  const { caseSensitive = false, useRegex = false } = options;

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) {
      setFilteredIndices([]);
      return rows;
    }

    const indices: number[] = [];

    // Compile regex if needed
    let regex: RegExp | null = null;
    if (useRegex) {
      try {
        regex = new RegExp(searchTerm, caseSensitive ? '' : 'i');
      } catch {
        // Invalid regex, fall back to literal search
      }
    }

    const filtered = rows.filter((row, index) => {
      // Search on stripped text (without ANSI codes) for better UX
      const searchableText = row.strippedText || row.message;

      let matches = false;

      if (regex) {
        // Regex search
        matches = regex.test(searchableText) ||
                 (row.labels ? Object.values(row.labels).some(label => regex!.test(label)) : false);
      } else {
        // Literal search
        const text = caseSensitive ? searchableText : searchableText.toLowerCase();
        const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();

        matches = text.includes(term) ||
                 (row.labels ? Object.values(row.labels).some(label => {
                   const labelText = caseSensitive ? label : label.toLowerCase();
                   return labelText.includes(term);
                 }) : false);
      }

      if (matches) {
        indices.push(index);
      }

      return matches;
    });

    setFilteredIndices(indices);
    return filtered;
  }, [rows, searchTerm, caseSensitive, useRegex]);

  return {
    searchTerm,
    setSearchTerm,
    filteredRows,
    filteredIndices,
    hasFilter: searchTerm.trim().length > 0,
  };
}