import React, { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import AutoSizer from 'react-virtualized-auto-sizer';
import { LogRow, LogsPanelOptions } from '../types';
import { Row } from './Row';
import { applyFontSizeVars } from '../utils/fontSizing';

interface VirtualListProps {
  rows: LogRow[];
  options: LogsPanelOptions;
  height: number;
  width: number;
  onRowClick?: (row: LogRow, index: number) => void;
  selectedIndex?: number;
  onScroll?: (scrollOffset: number) => void;
}

export const VirtualList = memo<VirtualListProps>(({
  rows,
  options,
  height,
  width,
  onRowClick,
  selectedIndex,
  onScroll
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const renderItem = useCallback((index: number, row: LogRow) => {
    const handleClick = onRowClick ? () => onRowClick(row, index) : undefined;

    return (
      <Row
        row={row}
        options={options}
        isSelected={selectedIndex === index}
        onRowClick={handleClick}
      />
    );
  }, [options, selectedIndex, onRowClick]);

  // With line-height: normal, rows are naturally ~1.2-1.3x font-size
  // For 14px font: ~18px height
  const itemHeight = options.rowHeight === 'fixed' ? options.fixedRowHeight : 18;
  const maxRows = Math.min(rows.length, options.maxRenderableRows);
  const displayRows = rows.slice(0, maxRows);

  // Apply font sizing CSS variables when row height or font family changes
  useEffect(() => {
    if (containerRef.current) {
      applyFontSizeVars(containerRef.current, itemHeight, options.fontFamily);
    }
  }, [itemHeight, options.fontFamily]);

  return (
    <div ref={containerRef} className="ansi-logs-container" style={{ height, width }}>
      <Virtuoso
        data={displayRows}
        totalCount={displayRows.length}
        itemContent={renderItem}
        style={{ height, width }}
        initialTopMostItemIndex={displayRows.length > 0 ? displayRows.length - 1 : 0}
        followOutput="smooth"
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
  rows: LogRow[];
  options: LogsPanelOptions;
  onRowClick?: (row: LogRow, index: number) => void;
  selectedIndex?: number;
  onScroll?: (scrollOffset: number) => void;
  minHeight?: number;
}

export const AutoSizedVirtualList = memo<AutoSizedVirtualListProps>(({
  rows,
  options,
  onRowClick,
  selectedIndex,
  onScroll,
  minHeight = 200
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
            selectedIndex={selectedIndex}
            onScroll={onScroll}
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

export function useVirtualListSearch(rows: LogRow[], options: SearchOptions = {}) {
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