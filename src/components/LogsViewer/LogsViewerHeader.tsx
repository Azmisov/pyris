import React from 'react';
import { SettingsDropdown } from './SettingsDropdown';
import { SearchBar } from './SearchBar';
import { ToggleSwitch } from './ToggleSwitch';
import { Icon } from '@grafana/ui';
import toolbarStyles from '../toolbar.module.css';
import styles from './LogsViewer.module.css';

interface LogsViewerHeaderProps {
  // Settings props
  settingsOpen: boolean;
  onToggleSettings: () => void;
  themeMode: 'grafana' | 'system' | 'light' | 'dark';
  onThemeModeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  effectiveThemeMode: 'dark' | 'light';
  availableThemeOptions: Array<{ value: string; label: string }>;
  currentTheme: string;
  onThemeChange: (value: string) => void;
  rowHeight: 'auto' | 'fixed';
  fixedRowHeight: number;
  onRowHeightAuto: () => void;
  onRowHeightFixed: () => void;
  onRowHeightIncrement: () => void;
  onRowHeightDecrement: () => void;

  // Wrap mode props
  wrapMode: 'nowrap' | 'soft-wrap';
  onToggleWrapMode: () => void;

  // Sort props
  sortOrder: 'asc' | 'desc';
  onToggleSortOrder: () => void;

  // Timeline props
  showTimeline: boolean;
  onToggleTimeline: () => void;

  // Search props
  searchTerm: string;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  caseSensitive: boolean;
  onCaseSensitiveToggle: () => void;
  useRegex: boolean;
  onRegexToggle: () => void;
  hasFilter: boolean;
  onClearSearch: () => void;
  searchExpanded: boolean;
  onToggleSearch: () => void;
  expressionError?: string | null;

  // Stats props
  filteredRowsLength: number;
  totalRowsLength: number;

  // View mode props
  viewMode: 'ansi' | 'json';
  onViewModeChange: (mode: 'ansi' | 'json') => void;

  // Copy props
  onCopyAll: () => void;
  onCopySelected: () => void;
  hasSelection: boolean;

  // Labels props
  selectedLabels?: Record<string, string>;
  onShowLabels?: () => void;

  // Errors props
  hasErrors?: boolean;
  onShowErrors?: () => void;
}

export const LogsViewerHeader: React.FC<LogsViewerHeaderProps> = ({
  settingsOpen,
  onToggleSettings,
  themeMode,
  onThemeModeChange,
  effectiveThemeMode,
  availableThemeOptions,
  currentTheme,
  onThemeChange,
  rowHeight,
  fixedRowHeight,
  onRowHeightAuto,
  onRowHeightFixed,
  onRowHeightIncrement,
  onRowHeightDecrement,
  wrapMode,
  onToggleWrapMode,
  sortOrder,
  onToggleSortOrder,
  showTimeline,
  onToggleTimeline,
  searchTerm,
  onSearchChange,
  caseSensitive,
  onCaseSensitiveToggle,
  useRegex,
  onRegexToggle,
  hasFilter,
  onClearSearch,
  searchExpanded,
  onToggleSearch,
  expressionError,
  filteredRowsLength,
  totalRowsLength,
  viewMode,
  onViewModeChange,
  onCopyAll,
  onCopySelected,
  hasSelection,
  selectedLabels,
  onShowLabels,
  hasErrors,
  onShowErrors,
}) => {
  const hasLabels = selectedLabels && Object.keys(selectedLabels).length > 0;
  return (
    <div className={styles.header}>
      {/* Left toolbar wrapper */}
      <div className={toolbarStyles.wrapper}>
        {/* Toolbar icons */}
        <div className={toolbarStyles.left}>
          <SettingsDropdown
            isOpen={settingsOpen}
            onToggle={onToggleSettings}
            themeMode={themeMode}
            onThemeModeChange={onThemeModeChange}
            effectiveThemeMode={effectiveThemeMode}
            availableThemeOptions={availableThemeOptions}
            currentTheme={currentTheme}
            onThemeChange={onThemeChange}
            rowHeight={rowHeight}
            fixedRowHeight={fixedRowHeight}
            onRowHeightAuto={onRowHeightAuto}
            onRowHeightFixed={onRowHeightFixed}
            onRowHeightIncrement={onRowHeightIncrement}
            onRowHeightDecrement={onRowHeightDecrement}
          />
          <button
            onClick={onToggleSortOrder}
            className={toolbarStyles.button}
            title={sortOrder === 'asc' ? 'Sort: Oldest First (click for Newest First)' : 'Sort: Newest First (click for Oldest First)'}
            aria-label="Toggle Sort Order"
          >
            {sortOrder === 'asc' ? <Icon name="sort-amount-down" /> : <Icon name="sort-amount-up" />}
          </button>
          <button
            onClick={onToggleWrapMode}
            className={`${toolbarStyles.button} ${wrapMode === 'soft-wrap' ? toolbarStyles.active : ''}`}
            title={wrapMode === 'nowrap' ? 'Enable Word Wrap' : 'Disable Word Wrap'}
            aria-label="Toggle Word Wrap"
          >
            <Icon name="wrap-text" />
          </button>
          <button
            onClick={onToggleTimeline}
            className={`${toolbarStyles.button} ${showTimeline ? toolbarStyles.active : ''}`}
            title={showTimeline ? 'Hide Timeline' : 'Show Timeline'}
            aria-label="Toggle Timeline"
          >
            <Icon name="graph-bar" />
          </button>
        </div>

        {/* Search input group */}
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          caseSensitive={caseSensitive}
          onCaseSensitiveToggle={onCaseSensitiveToggle}
          useRegex={useRegex}
          onRegexToggle={onRegexToggle}
          hasFilter={hasFilter}
          onClearSearch={onClearSearch}
          searchExpanded={searchExpanded}
          onToggleSearch={onToggleSearch}
          expressionError={expressionError}
          isExpressionMode={viewMode === 'json'}
        />
      </div>

      <div className={styles.stats}>
        <span className={styles.rowCount}>
          {hasFilter ? `${filteredRowsLength} of ` : ''}{totalRowsLength} logs
        </span>
        <ToggleSwitch
          options={[
            { value: 'ansi', label: 'ANSI' },
            { value: 'json', label: 'JSON' }
          ]}
          value={viewMode}
          onChange={(value) => onViewModeChange(value as 'ansi' | 'json')}
        />
      </div>

      <div className={styles.controls}>
        {hasSelection && (
          <>
            {hasLabels && onShowLabels && (
              <button onClick={onShowLabels} className={toolbarStyles.copyButton} title="View labels">
                <Icon name="tag-alt" size='lg' />
              </button>
            )}
            <button onClick={onCopySelected} className={toolbarStyles.copyButton} title="Copy selected log">
              <Icon name="clipboard-alt" size='lg' />
            </button>
          </>
        )}
        <button onClick={onCopyAll} className={toolbarStyles.copyButton} title="Copy all logs">
          <Icon name="clipboard-alt" size='lg' /> All
        </button>
        {hasErrors && onShowErrors && (
          <button onClick={onShowErrors} className={toolbarStyles.button} title="View data loading errors">
            <Icon name="exclamation-triangle" size='lg' />
          </button>
        )}
      </div>
    </div>
  );
};
