import React, { memo, useMemo, useCallback, useRef, useEffect, useLayoutEffect, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import AutoSizer from 'react-virtualized-auto-sizer';
import { AnsiLogRow, LogRow, LogsPanelOptions } from '../types';
import { Row } from './Row';
import { JsonRow } from './JsonRow';
import { TruncationWarning } from './TruncationWarning';
import { applyFontSizeVars } from '../utils/fontSizing';
import styles from './VirtualList.module.css';

interface VirtualListProps {
  rows: LogRow[];
  options: LogsPanelOptions;
  height: number;
  width: number;
  onRowClick?: (row: LogRow, index: number) => void;
  onRowHover?: (row: LogRow | null, index: number | null) => void;
  onVisibleRangeChange?: (firstRow: LogRow | null, lastRow: LogRow | null) => void;
  selectedIndex?: number;
  onScroll?: (scrollOffset: number) => void;
  sortOrder?: 'asc' | 'desc';
  scrollToIndex?: { index: number; timestamp: number; behavior?: 'smooth' | 'auto'; align?: 'start' | 'center' | 'end' };
  expandedPaths?: Set<string>;
  onToggleExpand?: (path: string | string[]) => void;
  /** Total row count before truncation (used for row count warning) */
  totalRowCount?: number;
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
  onToggleExpand,
  totalRowCount,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const virtuosoRef = useRef<any>(null);
  // Track whether scrollToIndex has been consumed for this component instance
  // Resets on remount (view mode switch), persists across re-renders (sort order change)
  const scrollConsumedRef = useRef(false);

  // ============================================================================
  // SCROLL PRESERVATION
  // ============================================================================
  // Track current visible range using DISPLAY indices (not logical)
  // Display indices are what Virtuoso actually uses for scrolling
  const currentDisplayFirstRef = useRef<number | null>(null);
  const currentDisplayLastRef = useRef<number | null>(null);
  // Track previous props to detect changes
  const prevSortOrderRef = useRef<'asc' | 'desc'>(sortOrder);
  const prevWrapModeRef = useRef(options.wrapMode);
  const prevRowHeightRef = useRef(options.rowHeight);
  const prevFixedRowHeightRef = useRef(options.fixedRowHeight);
  // Flag to disable followOutput during scroll restoration
  const isRestoringRef = useRef(false);

  // With line-height: normal, rows are naturally ~1.2-1.3x font-size
  // For 14px font: ~18px height
  const itemHeight = options.rowHeight === 'fixed' ? options.fixedRowHeight : 18;
  const maxRows = Math.min(rows.length, options.maxRenderableRows);

  // Rows are already in ascending order from LogsViewer
  // Just reverse for desc display
  const displayRows = useMemo(() => {
    let displayRows = rows;
    let desc = sortOrder === 'desc';
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

  // Handle visible range changes - track display indices for scroll restoration
  const handleRangeChanged = useCallback((range: { startIndex: number; endIndex: number }) => {
    console.log('[VirtualList] rangeChanged:', range, 'displayRows.length:', displayRows.length);

    // Track display indices for internal scroll restoration
    // Only skip during active restoration to avoid capturing intermediate values
    if (!isRestoringRef.current) {
      currentDisplayFirstRef.current = range.startIndex;
      currentDisplayLastRef.current = range.endIndex;
    }

    // Notify parent with visible rows (for timeline indicators)
    if (onVisibleRangeChange) {
      const firstRow = displayRows[range.startIndex] || null;
      const lastRow = displayRows[range.endIndex] || null;
      onVisibleRangeChange(firstRow, lastRow);
    }
  }, [displayRows, onVisibleRangeChange]);

  // ============================================================================
  // SCROLL RESTORATION ON PROP CHANGES
  // ============================================================================
  // Use useLayoutEffect to detect prop changes BEFORE paint
  // This allows us to restore scroll position synchronously
  useLayoutEffect(() => {
    const sortOrderChanged = prevSortOrderRef.current !== sortOrder;
    const wrapModeChanged = prevWrapModeRef.current !== options.wrapMode;
    const rowHeightChanged = prevRowHeightRef.current !== options.rowHeight;
    const fixedRowHeightChanged = prevFixedRowHeightRef.current !== options.fixedRowHeight;

    const needsRestoration = sortOrderChanged || wrapModeChanged || rowHeightChanged || fixedRowHeightChanged;

    console.log('[VirtualList] useLayoutEffect check:', {
      sortOrderChanged,
      wrapModeChanged,
      rowHeightChanged,
      fixedRowHeightChanged,
      needsRestoration,
      displayRowsLength: displayRows.length,
    });

    if (!needsRestoration || !virtuosoRef.current) {
      // Update refs even when no restoration needed
      prevSortOrderRef.current = sortOrder;
      prevWrapModeRef.current = options.wrapMode;
      prevRowHeightRef.current = options.rowHeight;
      prevFixedRowHeightRef.current = options.fixedRowHeight;
      return;
    }

    // Capture the display indices BEFORE updating refs
    // These are from the PREVIOUS render (before prop change)
    const prevDisplayFirst = currentDisplayFirstRef.current;
    const prevDisplayLast = currentDisplayLastRef.current;
    const prevSortOrder = prevSortOrderRef.current;
    const N = displayRows.length;

    // Update refs for next time
    prevSortOrderRef.current = sortOrder;
    prevWrapModeRef.current = options.wrapMode;
    prevRowHeightRef.current = options.rowHeight;
    prevFixedRowHeightRef.current = options.fixedRowHeight;

    if (prevDisplayFirst === null || prevDisplayLast === null || N === 0) {
      return;
    }

    // Calculate target display index based on what changed
    let targetDisplayIndex: number;

    if (sortOrderChanged) {
      // When sort order flips, the display array reverses
      // The row that was at prevDisplayLast is now at (N - 1 - prevDisplayLast)
      // We want that row to be at the TOP of the viewport
      //
      // In ASC mode: newest at bottom (high display index)
      // In DESC mode: newest at top (low display index)
      // When toggling, the "bottom" row should become the "top" row
      targetDisplayIndex = N - 1 - prevDisplayLast;
    } else {
      // For non-sort-order changes (wrapMode, rowHeight), keep same position
      // The first visible row should stay at the top
      targetDisplayIndex = prevDisplayFirst;
    }

    // Clamp to valid range
    targetDisplayIndex = Math.max(0, Math.min(targetDisplayIndex, N - 1));

    console.log('[VirtualList] Restoring scroll:', {
      sortOrderChanged,
      prevSortOrder,
      newSortOrder: sortOrder,
      prevDisplayFirst,
      prevDisplayLast,
      targetDisplayIndex,
      N
    });

    // Set restoring flag to disable followOutput and prevent capturing intermediate values
    isRestoringRef.current = true;

    // Scroll immediately (synchronously in layout phase)
    virtuosoRef.current.scrollToIndex({
      index: targetDisplayIndex,
      align: 'start',
      behavior: 'auto',
    });

    // IMMEDIATELY update refs with the expected new position
    // This is critical: if the user toggles again before rangeChanged fires,
    // we need valid refs. The viewport size stays roughly the same.
    const viewportSize = prevDisplayLast - prevDisplayFirst;
    currentDisplayFirstRef.current = targetDisplayIndex;
    currentDisplayLastRef.current = Math.min(targetDisplayIndex + viewportSize, N - 1);

    console.log('[VirtualList] Updated refs after scroll:', {
      newFirst: currentDisplayFirstRef.current,
      newLast: currentDisplayLastRef.current
    });

    // Clear restoring flag after Virtuoso has processed the scroll
    // Use RAF to ensure we're past the scroll event handlers
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isRestoringRef.current = false;
        console.log('[VirtualList] Scroll restoration complete');
      });
    });
  }, [sortOrder, options.wrapMode, options.rowHeight, options.fixedRowHeight, displayRows.length]);

  // Header height for top padding to go past the top shadow of the panel
  const HEADER_HEIGHT = 6;

  // Apply font sizing CSS variables when row height or font family changes
  useEffect(() => {
    if (containerRef.current) {
      applyFontSizeVars(containerRef.current, itemHeight, options.fontFamily);
    }
  }, [itemHeight, options.fontFamily]);

  // Handle external scrollToIndex requests - convert logical index to display index
  // Only runs if scrollToIndex hasn't been consumed yet (prevents re-scroll on sort order changes)
  useEffect(() => {
    if (scrollToIndex && virtuosoRef.current && !scrollConsumedRef.current && displayRows.length > 0) {
      // Mark as consumed so this won't fire again on sort order change
      scrollConsumedRef.current = true;

      // Clamp the index to valid range before converting
      const clampedLogicalIndex = Math.max(0, Math.min(scrollToIndex.index, displayRows.length - 1));
      const displayIndex = logicalToDisplay(clampedLogicalIndex);
      const align = scrollToIndex.align || 'center';
      const behavior = scrollToIndex.behavior || 'smooth';
      // Add offset for 'start' alignment to push row below header/shadow
      const offset = align === 'start' ? -HEADER_HEIGHT : undefined;

      console.log('[VirtualList] scrollToIndex effect:', {
        logicalIndex: scrollToIndex.index,
        clampedLogicalIndex,
        displayIndex,
        align,
        behavior,
        offset,
      });

      virtuosoRef.current.scrollToIndex({
        index: displayIndex,
        align,
        behavior,
        offset,
      });
    }
  }, [scrollToIndex, logicalToDisplay, displayRows.length, sortOrder]);

  // Configure initial scroll position - use scrollToIndex only on first render of this instance
  // (for view mode switch remount), otherwise default based on sort order
  const initialTopMostItem = useMemo(() => {
    // Only use scrollToIndex if not already consumed this mount and we have rows
    // This prevents stale scrollToIndex from affecting sort order changes
    if (scrollToIndex && !scrollConsumedRef.current && displayRows.length > 0) {
      scrollConsumedRef.current = true;
      // Clamp the index to valid range before converting
      const clampedLogicalIndex = Math.max(0, Math.min(scrollToIndex.index, displayRows.length - 1));
      const displayIndex = logicalToDisplay(clampedLogicalIndex);
      const align = scrollToIndex.align || 'center';
      console.log('[VirtualList] initialTopMostItem from scrollToIndex:', displayIndex, 'align:', align, 'clamped from:', scrollToIndex.index);
      return {
        index: displayIndex,
        align,
        behavior: scrollToIndex.behavior || 'auto',
        offset: align === 'start' ? -HEADER_HEIGHT : undefined,
      };
    }
    // Default: start at "newest" logs position
    const index = sortOrder === 'asc'
      ? (displayRows.length > 0 ? displayRows.length - 1 : 0)  // Bottom (newest at end)
      : 0;  // Top (newest at start after reverse)
    console.log('[VirtualList] initialTopMostItem default:', index, 'sortOrder:', sortOrder);
    return index;
  }, [scrollToIndex, sortOrder, displayRows.length, logicalToDisplay]);

  // Compute className based on wrap mode
  const virtualListClassName = useMemo(() => {
    const classes = [styles.list];
    if (options.wrapMode === 'soft-wrap') {
      classes.push(styles.wrapEnabled);
    }
    return classes.join(' ');
  }, [options.wrapMode]);

  // Disable followOutput - it causes issues with view mode switching and scroll restoration
  // Users can scroll manually; auto-follow is rarely needed for dashboard log panels
  const followOutputValue = false;

  // When word wrap is disabled, all rows have fixed height - use this for Virtuoso optimization
  // This skips per-item measurement and significantly improves scroll performance
  const useFixedHeight = options.wrapMode === 'nowrap';

  // Overscan: Chunks rendering to reduce re-render frequency (renders in batches of ~200px)
  // Note: We avoid increaseViewportBy as it affects rangeChanged reporting, breaking timeline indicators
  const overscanConfig = useMemo(() => ({ main: 200, reverse: 200 }), []);

  // Determine if we need to show row count warning
  const effectiveTotalRowCount = totalRowCount ?? rows.length;
  const hasRowCountTruncation = effectiveTotalRowCount > options.maxRenderableRows;

  // Header component with row count warning only
  // Line truncation indicators are shown inline at the end of each truncated row
  const HeaderComponent = useMemo(() => {
    if (!hasRowCountTruncation) {
      const EmptyHeader = () => <div style={{ height: HEADER_HEIGHT }} />;
      EmptyHeader.displayName = 'EmptyHeader';
      return EmptyHeader;
    }

    const TruncationHeader = () => (
      <div style={{ paddingTop: HEADER_HEIGHT }}>
        <TruncationWarning
          type="row-count"
          displayedCount={maxRows}
          totalCount={effectiveTotalRowCount}
        />
      </div>
    );
    TruncationHeader.displayName = 'TruncationHeader';
    return TruncationHeader;
  }, [hasRowCountTruncation, maxRows, effectiveTotalRowCount]);

  return (
    <div ref={containerRef} className={styles.container} style={{ height, width }}>
      <Virtuoso
        ref={virtuosoRef}
        data={displayRows}
        totalCount={displayRows.length}
        itemContent={renderItem}
        style={{ height, width }}
        initialTopMostItemIndex={initialTopMostItem}
        followOutput={followOutputValue}
        rangeChanged={handleRangeChanged}
        className={virtualListClassName}
        fixedItemHeight={useFixedHeight ? itemHeight : undefined}
        overscan={overscanConfig}
        components={{
          Header: HeaderComponent,
        }}
      />
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
  onVisibleRangeChange?: (firstRow: LogRow | null, lastRow: LogRow | null) => void;
  selectedIndex?: number;
  onScroll?: (scrollOffset: number) => void;
  minHeight?: number;
  sortOrder?: 'asc' | 'desc';
  scrollToIndex?: { index: number; timestamp: number; behavior?: 'smooth' | 'auto'; align?: 'start' | 'center' | 'end' };
  expandedPaths?: Set<string>;
  onToggleExpand?: (path: string | string[]) => void;
  /** Total row count before truncation (used for row count warning) */
  totalRowCount?: number;
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
  onToggleExpand,
  totalRowCount,
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
            totalRowCount={totalRowCount}
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
