import React, { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { EventBus, DataHoverEvent, DataHoverClearEvent } from '@grafana/data';
// throttleTime no longer used - we do custom throttling after stale detection
import { AutoSizedVirtualList, useVirtualListSearch } from '../../render/VirtualList';
import { cleanupCaches } from '../../utils/memo';
import { stripAnsiCodes } from '../../converters/ansi';
import { LogsPanelOptions, LogRow, ParsedLogsResult } from '../../types';
import { getDarkColorSchemeOptions, getLightColorSchemeOptions, getColorScheme } from '../../theme/colorSchemes';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useThemeManagement } from './hooks/useThemeManagement';
import { useClipboard } from './hooks/useClipboard';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useLinkModal } from './hooks/useLinkModal';
import { LogsViewerHeader } from './LogsViewerHeader';
import { LinkConfirmationModal } from './LinkConfirmationModal';
import { ErrorState } from './ErrorState';
import { LogsTimeline } from '../LogsTimeline';
import { parseExpression } from '../../utils/jsonExpression';

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
  timeZone?: string;
  className?: string;
  /** Grafana event bus for cursor synchronization (shared crosshair) */
  eventBus?: EventBus;
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
  timeZone,
  className = '',
  eventBus,
}) => {
  // Merge user options with defaults
  const options = useMemo(
    () => ({ ...defaultViewerOptions, ...userOptions }),
    [userOptions]
  );

  // State management
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | undefined>();
  const [hoveredTimestamp, setHoveredTimestamp] = useState<number | null>(null);
  // Use ref for isExternalHover to ensure synchronous updates (avoids race conditions with state)
  const isExternalHoverRef = useRef(false);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
  const [visibleRange, setVisibleRange] = useState<{ firstIndex: number | null; lastIndex: number | null; first: number | null; last: number | null }>({ firstIndex: null, lastIndex: null, first: null, last: null });
  const [scrollToIndex, setScrollToIndex] = useState<{ index: number; timestamp: number; behavior?: 'smooth' | 'auto'; align?: 'start' | 'center' | 'end' } | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jsonExpandedPaths, setJsonExpandedPaths] = useState<Set<string>>(new Set());
  const [expressionError, setExpressionError] = useState<string | null>(null);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

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
  // Track if mouse is inside the panel (to ignore external events while inside)
  const isMouseInsidePanelRef = useRef(false);
  // Track when we're publishing events to the event bus
  const isPublishingRef = useRef(false);

  /*
   * ===================================================================================
   * SHARED CROSSHAIR / CURSOR SYNC
   * ===================================================================================
   *
   * Grafana's shared crosshair feature allows panels to synchronize hover states via
   * DataHoverEvent and DataHoverClearEvent on the dashboard's event bus. However, there
   * are several quirks that require careful handling:
   *
   * QUIRK 1: Cross-panel interference (flickering)
   * ----------------------------------------------
   * Problem: When hovering panel-A, panel-B might send unrelated clear events (e.g.,
   * timeseries panels send clears during internal state changes). If we blindly process
   * all clears, our hover indicator flickers.
   *
   * Solution: Per-source state tracking. We track which panel our current hover came
   * from (currentHoverSourceRef) and only process clears from that same source.
   * Clears from other panels are ignored.
   *
   * QUIRK 2: Stale events after clear
   * ---------------------------------
   * Problem: Due to event bus timing, a hover event generated BEFORE a clear can arrive
   * AFTER the clear, causing the hover indicator to reappear incorrectly.
   *
   * Solution: Per-source stale window. When we receive a clear from panel-X, we record
   * the time. Any hover from panel-X arriving within STALE_WINDOW_MS is ignored as stale.
   *
   * QUIRK 3: Quick re-entry filtering
   * ---------------------------------
   * Problem: If using RxJS throttleTime() on subscriptions, legitimate hovers during
   * quick panel re-entry can be dropped before we evaluate them.
   *
   * Solution: Process ALL events unthrottled for stale detection, then throttle state
   * updates. This ensures we see every event for proper filtering while still limiting
   * React re-renders.
   *
   * QUIRK 4: Self-event filtering
   * -----------------------------
   * Problem: When we publish hover events, we also receive them back.
   *
   * Solution: Use isMouseInsidePanelRef - when mouse is inside our panel, we ignore
   * all external events and handle everything internally via row hover callbacks.
   *
   * Event origin identification uses: evt.origin._eventsOrigin.getPathId() which
   * returns panel keys like "panel-3".
   * ===================================================================================
   */

  // Per-source hover state: track hover and clear times independently per source panel
  interface SourceHoverState {
    timestamp: number | null;  // Current hover timestamp from this source
    lastClearTime: number;     // When we last received a clear from this source
  }
  const perSourceStateRef = useRef<Map<string, SourceHoverState>>(new Map());
  // Track which source panel our currently displayed hover came from
  const currentHoverSourceRef = useRef<string | null>(null);
  // Window to ignore stale hovers after a clear from the same source
  const STALE_WINDOW_MS = 100;

  // Subscribe to Grafana cursor sync events (shared crosshair)
  useEffect(() => {
    if (!eventBus) return;

    // Helper to get origin panel key from event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getOriginPanelKey = (evt: any): string | null => {
      return evt.origin?._eventsOrigin?.getPathId?.() ?? null;
    };

    // Helper to get or create source state
    const getSourceState = (key: string): SourceHoverState => {
      let state = perSourceStateRef.current.get(key);
      if (!state) {
        state = { timestamp: null, lastClearTime: 0 };
        perSourceStateRef.current.set(key, state);
      }
      return state;
    };

    // Track pending hover update for throttling
    let pendingHoverUpdate: { timestamp: number; originPanelKey: string } | null = null;
    let hoverThrottleTimeout: ReturnType<typeof setTimeout> | null = null;
    const HOVER_THROTTLE_MS = 50;

    // Apply a pending hover update
    const applyPendingHover = () => {
      if (pendingHoverUpdate) {
        const { timestamp, originPanelKey } = pendingHoverUpdate;
        currentHoverSourceRef.current = originPanelKey;
        isExternalHoverRef.current = true;
        setHoveredTimestamp(timestamp);
        pendingHoverUpdate = null;
      }
      hoverThrottleTimeout = null;
    };

    // Subscribe to hover events (unthrottled - we do stale detection first, then throttle updates)
    const hoverSub = eventBus
      .getStream(DataHoverEvent)
      .subscribe({
        next: (evt) => {
          // Filter out events when mouse is inside panel - we handle everything internally
          if (isMouseInsidePanelRef.current) return;

          const timestamp = evt.payload?.point?.time;
          const originPanelKey = getOriginPanelKey(evt);
          if (!originPanelKey || typeof timestamp !== 'number') return;

          // Get per-source state and check for stale hovers
          const sourceState = getSourceState(originPanelKey);
          const timeSinceClear = performance.now() - sourceState.lastClearTime;

          // Filter stale hovers: hovers arriving shortly after a clear from the SAME source
          if (timeSinceClear < STALE_WINDOW_MS) {
            return;
          }

          // Update per-source state
          sourceState.timestamp = timestamp;

          // Queue hover update (throttled)
          pendingHoverUpdate = { timestamp, originPanelKey };
          if (!hoverThrottleTimeout) {
            // First event - apply immediately, then start throttle window
            applyPendingHover();
            hoverThrottleTimeout = setTimeout(() => {
              applyPendingHover(); // Apply any pending update at end of window
            }, HOVER_THROTTLE_MS);
          }
          // If throttle active, pendingHoverUpdate will be applied when timeout fires
        },
      });

    // Subscribe to clear events (no throttling - clears should be processed immediately)
    const clearSub = eventBus
      .getStream(DataHoverClearEvent)
      .subscribe({
        next: (evt) => {
          // Filter out events when mouse is inside panel - we handle everything internally
          if (isMouseInsidePanelRef.current) return;

          const originPanelKey = getOriginPanelKey(evt);
          if (!originPanelKey) return;

          // Update per-source state: mark clear time for this source
          const sourceState = getSourceState(originPanelKey);
          sourceState.timestamp = null;
          sourceState.lastClearTime = performance.now();

          // Cancel any pending hover from this source (prevents stale throttled hovers)
          if (pendingHoverUpdate?.originPanelKey === originPanelKey) {
            pendingHoverUpdate = null;
          }

          // Only clear our displayed hover if it came from this source
          if (currentHoverSourceRef.current === originPanelKey) {
            currentHoverSourceRef.current = null;
            isExternalHoverRef.current = false;
            setHoveredTimestamp(null);
          }
        },
      });

    return () => {
      hoverSub.unsubscribe();
      clearSub.unsubscribe();
      if (hoverThrottleTimeout) {
        clearTimeout(hoverThrottleTimeout);
      }
    };
  }, [eventBus]);

  // Theme management
  const effectiveThemeMode = useThemeManagement(themeMode, darkTheme, lightTheme);

  // Select log rows based on view mode
  const logRows: LogRow[] = useMemo(() => {
    try {
      setError(null);

      // Process rows based on type
      const rows: LogRow[] = viewMode === 'json'
        ? parsedData.jsonLogs.map((log, index) => ({
            timestamp: log.timestamp,
            seriesIndex: log.seriesIndex ?? index,
            data: log.data,
            labels: log.labels,
            id: log.id,
            level: log.level,
          }))
        : parsedData.ansiLogs.map((log, index) => ({
            timestamp: log.timestamp,
            seriesIndex: log.seriesIndex ?? index,
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
  }, [parsedData.ansiLogs, parsedData.jsonLogs, sortOrder, viewMode]);

  // Memoize ANSI-only rows for search hook to prevent infinite re-renders
  const ansiOnlyRows = useMemo(() => {
    return logRows.filter((row): row is LogRow & { message: string } => 'message' in row);
  }, [logRows]);

  // Apply search/filtering (only for ANSI logs)
  const {
    searchTerm,
    setSearchTerm,
    filteredRows: searchFilteredRows,
    hasFilter: ansiHasFilter
  } = useVirtualListSearch(ansiOnlyRows as any, { caseSensitive, useRegex });

  // Debounce search term for expression evaluation (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Parse expression immediately for error display (no debounce)
  const immediateExpression = useMemo(() => {
    if (viewMode !== 'json' || !searchTerm.trim()) {
      return null;
    }
    const result = parseExpression(searchTerm);
    if (result.error) {
      console.log('[Expression] Syntax error detected:', result.error);
    }
    return result;
  }, [viewMode, searchTerm]);

  // Parse expression with debounce for filtering
  const parsedExpression = useMemo(() => {
    if (viewMode !== 'json' || !debouncedSearchTerm.trim()) {
      return null;
    }
    return parseExpression(debouncedSearchTerm);
  }, [viewMode, debouncedSearchTerm]);

  // Apply expression filtering for JSON logs
  const { filteredRows, hasFilter, runtimeError } = useMemo(() => {
    if (viewMode === 'json') {
      // Apply expression filtering for JSON mode
      if (!debouncedSearchTerm.trim()) {
        return { filteredRows: logRows, hasFilter: false, runtimeError: null };
      }

      if (!parsedExpression || parsedExpression.error || !parsedExpression.filter) {
        return { filteredRows: logRows, hasFilter: false, runtimeError: null };
      }

      // Run actual filtering and catch runtime errors
      try {
        const filtered = logRows.filter(parsedExpression.filter);
        return { filteredRows: filtered, hasFilter: true, runtimeError: null };
      } catch (error) {
        // Runtime error during filtering - stop and report error
        const errorMsg = error instanceof Error ? error.message : 'Runtime error during filtering';
        return { filteredRows: logRows, hasFilter: false, runtimeError: errorMsg };
      }
    } else {
      // Use ANSI search results
      return { filteredRows: searchFilteredRows, hasFilter: ansiHasFilter, runtimeError: null };
    }
  }, [viewMode, logRows, debouncedSearchTerm, parsedExpression, searchFilteredRows, ansiHasFilter]);

  // Update expression error to include runtime errors
  useEffect(() => {
    if (viewMode !== 'json') {
      console.log('[Expression] Not in JSON mode, clearing error');
      setExpressionError(null);
    } else if (!searchTerm.trim()) {
      console.log('[Expression] Empty search term, clearing error');
      setExpressionError(null);
    } else if (runtimeError) {
      // Runtime error takes precedence
      console.log('[Expression] Setting runtime error:', runtimeError);
      setExpressionError(runtimeError);
    } else if (immediateExpression) {
      // Syntax/parse error
      const error = immediateExpression.error || null;
      console.log('[Expression] Setting syntax error:', error);
      setExpressionError(error);
    }
  }, [viewMode, searchTerm, immediateExpression, runtimeError]);

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
  const { copyAllLogs, copySelectedLog } = useClipboard(filteredRows as any, selectedRowIndex);

  // Keyboard navigation
  useKeyboardNavigation(
    filteredRows.length,
    selectedRowIndex,
    setSelectedRowIndex,
    copySelectedLog,
    copyAllLogs
  );

  // Handle row selection
  const handleRowClick = useCallback((row: LogRow, index: number) => {
    // Clear expand paths when switching to a different row
    if (selectedRowIndex !== index) {
      setJsonExpandedPaths(new Set());
    }

    setSelectedRowIndex(index);
    setSelectedTimestamp(row.timestamp);

    if (onRowClick) {
      const logData: LogData = {
        timestamp: row.timestamp,
        message: 'message' in row ? row.message : JSON.stringify(row.data),
        labels: row.labels,
        id: row.id,
        level: row.level,
      };
      onRowClick(logData, index);
    }
  }, [onRowClick, selectedRowIndex]);

  // Handle expand/collapse toggle for JSON nested structures
  const handleToggleExpand = useCallback((path: string) => {
    setJsonExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Handle row hover - also publishes to Grafana event bus for cursor sync
  const handleRowHover = useCallback((row: LogRow | null) => {
    const timestamp = row ? row.timestamp : null;

    // Only process if mouse is actually in this panel
    // This prevents feedback loops when receiving external hover events
    // (VirtualList may call onRowHover during re-renders triggered by external events)
    if (!isMouseInsidePanelRef.current) {
      return;
    }

    isExternalHoverRef.current = false; // Row hover is internal
    setHoveredTimestamp(timestamp);

    // Publish to Grafana event bus for shared crosshair (other panels will receive this)
    // Only publish actual hovers, not null - the panel mouse leave handler publishes clear
    // This prevents spurious clears from VirtualList calling onRowHover(null) during re-renders
    if (eventBus && timestamp !== null) {
      isPublishingRef.current = true;
      try {
        eventBus.publish(new DataHoverEvent({ point: { time: timestamp } }));
      } finally {
        isPublishingRef.current = false;
      }
    }
  }, [eventBus]);

  // Handle timeline hover - only publish to eventBus (timeline shows its own indicator)
  const handleTimelineHover = useCallback((timestamp: number | null) => {
    if (!eventBus) return;

    // Publish to other panels
    isPublishingRef.current = true;
    try {
      if (timestamp !== null) {
        eventBus.publish(new DataHoverEvent({ point: { time: timestamp } }));
      } else {
        eventBus.publish(new DataHoverClearEvent());
      }
    } finally {
      isPublishingRef.current = false;
    }
  }, [eventBus]);

  // Handle mouse entering/leaving the panel for external hover management
  const handlePanelMouseEnter = useCallback(() => {
    isMouseInsidePanelRef.current = true;
  }, []);

  const handlePanelMouseLeave = useCallback(() => {
    isMouseInsidePanelRef.current = false;
    // Clear internal hover state
    setHoveredTimestamp(null);
    isExternalHoverRef.current = false;

    // Publish clear event so other panels know we stopped hovering
    if (eventBus) {
      isPublishingRef.current = true;
      try {
        eventBus.publish(new DataHoverClearEvent());
      } finally {
        isPublishingRef.current = false;
      }
    }
  }, [eventBus]);

  // Handle visible range change
  const handleVisibleRangeChange = useCallback((firstRow: LogRow | null, lastRow: LogRow | null, startIndex: number, endIndex: number) => {
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

  // Preserve scroll position and selection when sort order changes (from any source)
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

      // Update selected row index if a row is selected
      // Find the selected row by its timestamp and update its index
      if (selectedTimestamp !== null && filteredRows.length > 0) {
        const newSelectedIndex = filteredRows.findIndex(row => row.timestamp === selectedTimestamp);
        if (newSelectedIndex !== -1) {
          setSelectedRowIndex(newSelectedIndex);
        }
      }

      // Update the ref for next comparison
      prevSortOrderRef.current = sortOrder;
    }
  }, [sortOrder, filteredRows, selectedTimestamp]);

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


  // Calculate content height (header + timeline)
  const timelineHeight = showTimeline ? 100 : 0;
  const headerHeight = 60;
  const contentHeight = height - headerHeight - timelineHeight;

  // Main render
  return (
    <div
      className={`ansi-logs-panel ${className}`}
      style={{ width, height }}
      onClick={handlePanelClick}
      onMouseEnter={handlePanelMouseEnter}
      onMouseLeave={handlePanelMouseLeave}
    >
      <div className="ansi-logs-top">
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
        expressionError={expressionError}
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
          logs={logRows as any}
          height={timelineHeight}
          hoveredTimestamp={filteredRows.length === 0 ? null : hoveredTimestamp}
          selectedTimestamp={filteredRows.length === 0 ? null : selectedTimestamp}
          visibleRange={filteredRows.length === 0 ? { firstIndex: null, lastIndex: null, first: null, last: null } : visibleRange}
          colorScheme={currentColorScheme}
          sortOrder={sortOrder}
          onLogSelect={handleLogSelect}
          onHoverChange={handleTimelineHover}
          onTimeRangeChange={onTimeRangeChange}
          dashboardTimeRange={dashboardTimeRange}
          fontFamily={options.fontFamily}
          timeZone={timeZone}
          isExternalHover={isExternalHoverRef.current}
        />
      )}
      </div>

      {/* Main log display */}
      <div className="ansi-logs-content">
        {filteredRows.length === 0 ? (
          <div className="empty-state">
            <p>No {viewMode === 'json' ? 'JSON' : 'ANSI'} logs</p>
          </div>
        ) : (
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
            expandedPaths={jsonExpandedPaths}
            onToggleExpand={handleToggleExpand}
          />
        )}
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
