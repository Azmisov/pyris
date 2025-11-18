import React, { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import AutoSizer from 'react-virtualized-auto-sizer';
import { AnsiLogRow, LogsPanelOptions } from '../types';
import { Row } from './Row';
import { applyFontSizeVars } from '../utils/fontSizing';

interface VirtualListProps {
  rows: AnsiLogRow[];
  options: LogsPanelOptions;
  height: number;
  width: number;
  onRowClick?: (row: AnsiLogRow, index: number) => void;
  onRowHover?: (row: AnsiLogRow | null, index: number | null) => void;
  onVisibleRangeChange?: (firstRow: AnsiLogRow | null, lastRow: AnsiLogRow | null, startIndex: number, endIndex: number) => void;
  selectedIndex?: number;
  onScroll?: (scrollOffset: number) => void;
  sortOrder?: 'asc' | 'desc';
  scrollToIndex?: { index: number; timestamp: number; behavior?: 'smooth' | 'auto'; align?: 'start' | 'center' | 'end' };
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
  scrollToIndex
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const virtuosoRef = useRef<any>(null);

  // With line-height: normal, rows are naturally ~1.2-1.3x font-size
  // For 14px font: ~18px height
  const itemHeight = options.rowHeight === 'fixed' ? options.fixedRowHeight : 18;
  const maxRows = Math.min(rows.length, options.maxRenderableRows);
  const displayRows = rows.slice(0, maxRows);

  // Debug: Log all rows being displayed
  useEffect(() => {
    console.log(`[DEBUG VirtualList] Displaying all ${displayRows.length} rows:`,
      displayRows.map(r => ({
        timestamp: r.timestamp,
        seriesIndex: r.seriesIndex,
        message: r.message.substring(0, 80)
      }))
    );
  }, [displayRows]);

  const renderItem = useCallback((index: number, row: AnsiLogRow) => {
    const handleClick = onRowClick ? () => onRowClick(row, index) : undefined;
    const handleHover = onRowHover ? (hoveredRow: AnsiLogRow | null) => onRowHover(hoveredRow, hoveredRow ? index : null) : undefined;

    return (
      <Row
        row={row}
        options={options}
        isSelected={selectedIndex === index}
        onRowClick={handleClick}
        onRowHover={handleHover}
      />
    );
  }, [options, selectedIndex, onRowClick, onRowHover]);

  // Handle visible range changes
  const handleRangeChanged = useCallback((range: { startIndex: number; endIndex: number }) => {
    if (!onVisibleRangeChange) return;

    const firstRow = displayRows[range.startIndex] || null;
    const lastRow = displayRows[range.endIndex] || null;
    onVisibleRangeChange(firstRow, lastRow, range.startIndex, range.endIndex);
  }, [displayRows, onVisibleRangeChange]);

  // Apply font sizing CSS variables when row height or font family changes
  useEffect(() => {
    if (containerRef.current) {
      applyFontSizeVars(containerRef.current, itemHeight, options.fontFamily);
    }
  }, [itemHeight, options.fontFamily]);

  // Handle scrollToIndex
  useEffect(() => {
    if (scrollToIndex && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: scrollToIndex.index,
        align: scrollToIndex.align || 'center',
        behavior: scrollToIndex.behavior || 'smooth',
      });
    }
  }, [scrollToIndex]);

  // Configure initial scroll position and follow behavior based on sort order
  const initialIndex = sortOrder === 'asc'
    ? (displayRows.length > 0 ? displayRows.length - 1 : 0)  // Bottom for ascending (oldest first)
    : 0;  // Top for descending (newest first)

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
        className="ansi-virtual-list"
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
  rows: AnsiLogRow[];
  options: LogsPanelOptions;
  onRowClick?: (row: AnsiLogRow, index: number) => void;
  onRowHover?: (row: AnsiLogRow | null, index: number | null) => void;
  onVisibleRangeChange?: (firstRow: AnsiLogRow | null, lastRow: AnsiLogRow | null, startIndex: number, endIndex: number) => void;
  selectedIndex?: number;
  onScroll?: (scrollOffset: number) => void;
  minHeight?: number;
  sortOrder?: 'asc' | 'desc';
  scrollToIndex?: { index: number; timestamp: number; behavior?: 'smooth' | 'auto'; align?: 'start' | 'center' | 'end' };
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
  scrollToIndex
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
      console.log(`[DEBUG useVirtualListSearch] No search term - returning all ${rows.length} rows`);
      return rows;
    }

    console.log(`[DEBUG useVirtualListSearch] Filtering ${rows.length} rows with term: "${searchTerm}"`);
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
    console.log(`[DEBUG useVirtualListSearch] Filtered to ${filtered.length} rows - All:`,
      filtered.map(r => ({
        timestamp: r.timestamp,
        seriesIndex: r.seriesIndex,
        message: r.message.substring(0, 80)
      }))
    );
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