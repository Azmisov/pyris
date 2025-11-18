import React from 'react';
import { SettingsDropdown } from './SettingsDropdown';
import { SearchBar } from './SearchBar';
import { Icon } from '@grafana/ui';

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

  // Stats props
  filteredRowsLength: number;
  totalRowsLength: number;

  // Copy props
  onCopyAll: () => void;
  onCopySelected: () => void;
  hasSelection: boolean;
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
  filteredRowsLength,
  totalRowsLength,
  onCopyAll,
  onCopySelected,
  hasSelection,
}) => {
  return (
    <div className="ansi-logs-header">
      {/* Left toolbar wrapper */}
      <div className="ansi-toolbar-wrapper">
        {/* Toolbar icons */}
        <div className="ansi-toolbar-left">
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
            className="ansi-toolbar-button"
            title={sortOrder === 'asc' ? 'Sort: Oldest First (click for Newest First)' : 'Sort: Newest First (click for Oldest First)'}
            aria-label="Toggle Sort Order"
          >
            {sortOrder === 'asc' ? <Icon name="sort-amount-down" /> : <Icon name="sort-amount-up" />}
          </button>
          <button
            onClick={onToggleWrapMode}
            className={`ansi-toolbar-button ${wrapMode === 'soft-wrap' ? 'active' : ''}`}
            title={wrapMode === 'nowrap' ? 'Enable Word Wrap' : 'Disable Word Wrap'}
            aria-label="Toggle Word Wrap"
          >
            <Icon name="wrap-text" />
          </button>
          <button
            onClick={onToggleTimeline}
            className={`ansi-toolbar-button ${showTimeline ? 'active' : ''}`}
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
        />
      </div>

      <div className="ansi-logs-stats">
        <span className="ansi-row-count">
          {hasFilter ? `${filteredRowsLength} of ` : ''}{totalRowsLength} rows
        </span>
        <span className="ansi-indicator">ANSI</span>
      </div>

      <div className="ansi-controls">
        <button onClick={onCopyAll} className="ansi-copy-button" title="Copy all logs">
          Copy All
        </button>
        {hasSelection && (
          <button onClick={onCopySelected} className="ansi-copy-button" title="Copy selected log">
            Copy Selected
          </button>
        )}
      </div>
    </div>
  );
};
