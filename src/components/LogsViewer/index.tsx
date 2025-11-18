import React, { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { AutoSizedVirtualList, useVirtualListSearch } from '../../render/VirtualList';
import { cleanupCaches } from '../../utils/memo';
import { stripAnsiCodes } from '../../converters/ansi';
import { LogsPanelOptions, AnsiLogRow, ParsedLogsResult } from '../../types';
import { getDarkColorSchemeOptions, getLightColorSchemeOptions, getColorScheme } from '../../theme/colorSchemes';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useThemeManagement } from './hooks/useThemeManagement';
import { useClipboard } from './hooks/useClipboard';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useLinkModal } from './hooks/useLinkModal';
import { LogsViewerHeader } from './LogsViewerHeader';
import { LinkConfirmationModal } from './LinkConfirmationModal';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';
import { LogsTimeline } from '../LogsTimeline';

/**
 * Simple log data interface for the viewer
 * This is Grafana-independent and can be used standalone
 */
export interface LogData {
  timestamp: number;
  message: string;
  labels?: Record<string, string>;
  id?: string;
  level?: string;
}

/**
 * Core LogsViewer component props - no Grafana dependencies
 */
export interface LogsViewerProps {
  parsedData: ParsedLogsResult;
  options?: Partial<LogsPanelOptions>;
  width?: number;
  height?: number;
  onRowClick?: (log: LogData, index: number) => void;
  onTimeRangeChange?: (startTimeMs: number, endTimeMs: number) => void;
  dashboardTimeRange?: { from: number; to: number };
  className?: string;
}

/**
 * Default options for the logs viewer
 */
const defaultViewerOptions: LogsPanelOptions = {
  themeMode: 'grafana',
  darkTheme: 'nord',
  lightTheme: 'solarized-light',
  wrapMode: 'nowrap',
  maxLineLength: 1000,
  rowHeight: 'auto',
  fixedRowHeight: 20,
  fontFamily: 'JetBrains Mono, Cascadia Mono, DejaVu Sans Mono, Consolas, Courier New, monospace',
  showLabels: true,
  selectedLabels: [],
  maxRenderableRows: 10000,
};

/**
 * Core LogsViewer Component
 *
 * This is a pure React component with no Grafana dependencies.
 * It can be used standalone or wrapped by Grafana panel adapters.
 */
export const LogsViewer = memo<LogsViewerProps>(({
  parsedData,
  options: userOptions = {},
  width,
  height = 600,
  onRowClick,
  onTimeRangeChange,
  dashboardTimeRange,
  className = '',
}) => {
  // Merge user options with defaults
  const options = useMemo(
    () => ({ ...defaultViewerOptions, ...userOptions }),
    [userOptions]
  );

  // State management
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | undefined>();
  const [hoveredTimestamp, setHoveredTimestamp] = useState<number | null>(null);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
  const [visibleRange, setVisibleRange] = useState<{ firstIndex: number | null; lastIndex: number | null; first: number | null; last: number | null }>({ firstIndex: null, lastIndex: null, first: null, last: null });
  const [scrollToIndex, setScrollToIndex] = useState<{ index: number; timestamp: number; behavior?: 'smooth' | 'auto'; align?: 'start' | 'center' | 'end' } | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // LocalStorage-backed state
  const [wrapMode, setWrapMode] = useLocalStorage('wrapMode', options.wrapMode || 'nowrap');
  const [themeMode, setThemeMode] = useLocalStorage('themeMode', options.themeMode || 'grafana');
  const [darkTheme, setDarkTheme] = useLocalStorage('darkTheme', options.darkTheme || 'nord');
  const [lightTheme, setLightTheme] = useLocalStorage('lightTheme', options.lightTheme || 'solarized-light');
  const [rowHeight, setRowHeight] = useLocalStorage('rowHeight', options.rowHeight || 'auto');
  const [fixedRowHeight, setFixedRowHeight] = useLocalStorage('fixedRowHeight', options.fixedRowHeight || 20);
  const [sortOrder, setSortOrder] = useLocalStorage<'asc' | 'desc'>('sortOrder', 'asc');
  const [showTimeline, setShowTimeline] = useLocalStorage('showTimeline', true);
  const [viewMode, setViewMode] = useLocalStorage<'ansi' | 'json'>('viewMode', 'ansi');

  // Ref to track previous sort order to detect changes from other panels
  const prevSortOrderRef = useRef<'asc' | 'desc'>(sortOrder);
  // Ref to store the last visible index for scroll preservation
  const lastVisibleIndexRef = useRef<number | null>(null);

  // Theme management
  const effectiveThemeMode = useThemeManagement(themeMode, darkTheme, lightTheme);

  // Process AnsiLogRow data (for now, ignore JSON logs)
  const logRows: AnsiLogRow[] = useMemo(() => {
    try {
      setError(null);
      const rows = parsedData.ansiLogs.map((log, index) => ({
        timestamp: log.timestamp,
        seriesIndex: log.seriesIndex ?? index, // Use provided index or assign one
        message: log.message,
        strippedText: log.strippedText || stripAnsiCodes(log.message),
        labels: log.labels,
        id: log.id,
        level: log.level,
      }));

      // Sort by timestamp, then by seriesIndex for stable ordering
      rows.sort((a, b) => {
        const timeDiff = sortOrder === 'asc'
          ? a.timestamp - b.timestamp
          : b.timestamp - a.timestamp;

        // If timestamps are equal, use seriesIndex to maintain original order
        if (timeDiff === 0) {
          const indexA = a.seriesIndex ?? 0;
          const indexB = b.seriesIndex ?? 0;
          return sortOrder === 'asc' ? indexA - indexB : indexB - indexA;
        }

        return timeDiff;
      });

      return rows;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error parsing data';
      setError(errorMessage);
      console.warn('Logs processing error:', err);
      return [];
    }
  }, [parsedData.ansiLogs, sortOrder]);

  // Apply search/filtering
  const {
    searchTerm,
    setSearchTerm,
    filteredRows,
    hasFilter
  } = useVirtualListSearch(logRows, { caseSensitive, useRegex });

  // Update options with local state
  const effectiveOptions = useMemo(() => ({
    ...options,
    wrapMode,
    themeMode,
    darkTheme,
    lightTheme,
    rowHeight,
    fixedRowHeight
  }), [options, wrapMode, themeMode, darkTheme, lightTheme, rowHeight, fixedRowHeight]);

  // Link modal management
  const {
    isModalOpen,
    pendingUrl,
    isFileUrl,
    isDangerousUrl,
    displayUrl,
    handlePanelClick,
    closeModal,
    copyUrl,
  } = useLinkModal();

  // Clipboard operations
  const { copyAllLogs, copySelectedLog } = useClipboard(filteredRows, selectedRowIndex);

  // Keyboard navigation
  useKeyboardNavigation(
    filteredRows.length,
    selectedRowIndex,
    setSelectedRowIndex,
    copySelectedLog,
    copyAllLogs
  );

  // Handle row selection
  const handleRowClick = useCallback((row: AnsiLogRow, index: number) => {
    setSelectedRowIndex(index);
    setSelectedTimestamp(row.timestamp);

    if (onRowClick) {
      const logData: LogData = {
        timestamp: row.timestamp,
        message: row.message,
        labels: row.labels,
        id: row.id,
        level: row.level,
      };
      onRowClick(logData, index);
    }
  }, [onRowClick]);

  // Handle row hover
  const handleRowHover = useCallback((row: AnsiLogRow | null) => {
    setHoveredTimestamp(row ? row.timestamp : null);
  }, []);

  // Handle visible range change
  const handleVisibleRangeChange = useCallback((firstRow: AnsiLogRow | null, lastRow: AnsiLogRow | null, startIndex: number, endIndex: number) => {
    setVisibleRange({
      firstIndex: startIndex,
      lastIndex: endIndex,
      first: firstRow ? firstRow.timestamp : null,
      last: lastRow ? lastRow.timestamp : null,
    });
    // Update ref for scroll preservation
    lastVisibleIndexRef.current = endIndex;
  }, []);

  // Handle log selection from timeline (binary search for nearest log)
  const handleLogSelect = useCallback((timestamp: number) => {
    if (filteredRows.length === 0) return;

    // Binary search to find nearest log by timestamp
    // Need to account for sort order (asc vs desc)
    let left = 0;
    let right = filteredRows.length - 1;
    let nearestIndex = 0;
    let minDiff = Infinity;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midTimestamp = filteredRows[mid].timestamp;
      const diff = Math.abs(midTimestamp - timestamp);

      if (diff < minDiff) {
        minDiff = diff;
        nearestIndex = mid;
      }

      // Adjust comparison based on sort order
      if (sortOrder === 'asc') {
        if (midTimestamp < timestamp) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      } else {
        // For descending order, reverse the comparison
        if (midTimestamp > timestamp) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }
    }

    // Select and scroll to the nearest log
    setSelectedRowIndex(nearestIndex);
    setSelectedTimestamp(filteredRows[nearestIndex].timestamp);
    setScrollToIndex({ index: nearestIndex, timestamp: Date.now() });
  }, [filteredRows, sortOrder]);

  // Handle search input
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setSelectedRowIndex(undefined);
    setSelectedTimestamp(null);
  }, [setSearchTerm]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSelectedRowIndex(undefined);
    setSelectedTimestamp(null);
  }, [setSearchTerm]);

  // Toggle search expansion
  const toggleSearch = useCallback(() => {
    if (searchExpanded && searchTerm) {
      setSearchTerm('');
    }
    setSearchExpanded(!searchExpanded);
  }, [searchExpanded, searchTerm, setSearchTerm]);

  // Toggle word wrap
  const toggleWrapMode = useCallback(() => {
    setWrapMode(prev => prev === 'nowrap' ? 'soft-wrap' : 'nowrap');
  }, [setWrapMode]);

  // Toggle sort order
  const toggleSortOrder = useCallback(() => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  }, [setSortOrder]);

  // Toggle timeline visibility
  const toggleTimeline = useCallback(() => {
    setShowTimeline(prev => !prev);
  }, [setShowTimeline]);

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: 'ansi' | 'json') => {
    setViewMode(mode);
  }, [setViewMode]);

  // Toggle settings dropdown
  const toggleSettings = useCallback(() => {
    setSettingsOpen(!settingsOpen);
  }, [settingsOpen]);

  // Get available theme options based on current mode
  const availableThemeOptions = useMemo(() => {
    return effectiveThemeMode === 'dark' ? getDarkColorSchemeOptions() : getLightColorSchemeOptions();
  }, [effectiveThemeMode]);

  const currentTheme = useMemo(() => {
    return effectiveThemeMode === 'dark' ? darkTheme : lightTheme;
  }, [effectiveThemeMode, darkTheme, lightTheme]);

  const currentColorScheme = useMemo(() => {
    return getColorScheme(currentTheme);
  }, [currentTheme]);

  // Settings change handlers
  const handleThemeModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setThemeMode(e.target.value as 'grafana' | 'system' | 'light' | 'dark');
  }, [setThemeMode]);

  const handleThemeChange = useCallback((value: string) => {
    if (effectiveThemeMode === 'dark') {
      setDarkTheme(value);
    } else {
      setLightTheme(value);
    }
  }, [effectiveThemeMode, setDarkTheme, setLightTheme]);

  const handleRowHeightAuto = useCallback(() => {
    setRowHeight('auto');
  }, [setRowHeight]);

  const handleRowHeightFixed = useCallback(() => {
    setRowHeight('fixed');
  }, [setRowHeight]);

  const handleRowHeightIncrement = useCallback(() => {
    if (rowHeight === 'fixed') {
      setFixedRowHeight(prev => Math.min(prev + 1, 50));
    }
  }, [rowHeight, setFixedRowHeight]);

  const handleRowHeightDecrement = useCallback(() => {
    if (rowHeight === 'fixed') {
      setFixedRowHeight(prev => Math.max(prev - 1, 10));
    }
  }, [rowHeight, setFixedRowHeight]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupCaches();
    };
  }, []);

  // Preserve scroll position when sort order changes (from any source)
  useEffect(() => {
    // Check if sort order actually changed
    if (prevSortOrderRef.current !== sortOrder) {
      // Use the last visible index captured before sort changes
      if (lastVisibleIndexRef.current !== null && filteredRows.length > 0) {
        const oldIndex = lastVisibleIndexRef.current;

        // When sort order is toggled, the array is reversed
        // So the new index is the inverse position
        const newIndex = filteredRows.length - 1 - oldIndex;

        // Scroll to the index instantly (no smooth scroll to avoid jank)
        setScrollToIndex({ index: newIndex, timestamp: Date.now(), behavior: 'auto', align: 'start' });
      }

      // Update the ref for next comparison
      prevSortOrderRef.current = sortOrder;
    }
  }, [sortOrder, filteredRows]);

  // Render error state
  if (error) {
    return (
      <ErrorState
        error={error}
        onDismiss={() => setError(null)}
        className={className}
        width={width}
        height={height}
      />
    );
  }

  // Render empty state
  if (logRows.length === 0) {
    return (
      <EmptyState
        className={className}
        width={width}
        height={height}
      />
    );
  }

  // Calculate content height (header + timeline)
  const timelineHeight = showTimeline ? 100 : 0;
  const headerHeight = 60;
  const contentHeight = height - headerHeight - timelineHeight;

  // Main render
  return (
    <div className={`ansi-logs-panel ${className}`} style={{ width, height }} data-theme={effectiveThemeMode} onClick={handlePanelClick}>
      <LogsViewerHeader
        settingsOpen={settingsOpen}
        onToggleSettings={toggleSettings}
        themeMode={themeMode}
        onThemeModeChange={handleThemeModeChange}
        effectiveThemeMode={effectiveThemeMode}
        availableThemeOptions={availableThemeOptions}
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
        rowHeight={rowHeight}
        fixedRowHeight={fixedRowHeight}
        onRowHeightAuto={handleRowHeightAuto}
        onRowHeightFixed={handleRowHeightFixed}
        onRowHeightIncrement={handleRowHeightIncrement}
        onRowHeightDecrement={handleRowHeightDecrement}
        wrapMode={wrapMode}
        onToggleWrapMode={toggleWrapMode}
        sortOrder={sortOrder}
        onToggleSortOrder={toggleSortOrder}
        showTimeline={showTimeline}
        onToggleTimeline={toggleTimeline}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        caseSensitive={caseSensitive}
        onCaseSensitiveToggle={() => setCaseSensitive(!caseSensitive)}
        useRegex={useRegex}
        onRegexToggle={() => setUseRegex(!useRegex)}
        hasFilter={hasFilter}
        onClearSearch={clearSearch}
        searchExpanded={searchExpanded}
        onToggleSearch={toggleSearch}
        filteredRowsLength={filteredRows.length}
        totalRowsLength={logRows.length}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onCopyAll={copyAllLogs}
        onCopySelected={copySelectedLog}
        hasSelection={selectedRowIndex !== undefined}
      />

      {/* Timeline */}
      {showTimeline && (
        <LogsTimeline
          logs={logRows}
          height={timelineHeight}
          hoveredTimestamp={hoveredTimestamp}
          selectedTimestamp={selectedTimestamp}
          visibleRange={visibleRange}
          colorScheme={currentColorScheme}
          sortOrder={sortOrder}
          onLogSelect={handleLogSelect}
          onTimeRangeChange={onTimeRangeChange}
          dashboardTimeRange={dashboardTimeRange}
        />
      )}

      {/* Main log display */}
      <div className="ansi-logs-content">
        <AutoSizedVirtualList
          key={filteredRows.length}
          rows={filteredRows}
          options={effectiveOptions}
          onRowClick={handleRowClick}
          onRowHover={handleRowHover}
          onVisibleRangeChange={handleVisibleRangeChange}
          selectedIndex={selectedRowIndex}
          minHeight={contentHeight}
          sortOrder={sortOrder}
          scrollToIndex={scrollToIndex}
        />
      </div>

      <LinkConfirmationModal
        isOpen={isModalOpen}
        url={pendingUrl}
        displayUrl={displayUrl}
        isFileUrl={isFileUrl}
        isDangerousUrl={isDangerousUrl}
        onClose={closeModal}
        onCopy={copyUrl}
      />
    </div>
  );
});

LogsViewer.displayName = 'LogsViewer';

export default LogsViewer;
