import React, { useRef, useEffect } from 'react';
import { ThemeSelect } from '../ThemeSelect';
import SettingsIcon from '../../icons/settings.svg';

interface SettingsDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  themeMode: 'dark' | 'light' | 'system';
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
}

export const SettingsDropdown: React.FC<SettingsDropdownProps> = ({
  isOpen,
  onToggle,
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
}) => {
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        onToggle();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div className="ansi-settings-container" ref={settingsRef}>
      <button
        onClick={onToggle}
        className={`ansi-toolbar-button ${isOpen ? 'active' : ''}`}
        title="Settings"
        aria-label="Settings"
      >
        <SettingsIcon />
      </button>
      {isOpen && (
        <div className="ansi-settings-dropdown">
          <div className="ansi-settings-item">
            <label htmlFor="theme-mode">Theme Mode</label>
            <select id="theme-mode" value={themeMode} onChange={onThemeModeChange}>
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div className="ansi-settings-item">
            <label htmlFor="theme">{effectiveThemeMode === 'dark' ? 'Dark' : 'Light'} Theme</label>
            <ThemeSelect
              id="theme"
              options={availableThemeOptions}
              value={currentTheme}
              onChange={onThemeChange}
            />
          </div>
          <div className="ansi-settings-item">
            <label htmlFor="row-height">Row Height</label>
            <div className="ansi-row-height-group">
              <button
                type="button"
                className={`ansi-row-height-btn ${rowHeight === 'auto' ? 'active' : ''}`}
                onClick={onRowHeightAuto}
              >
                Auto
              </button>
              <button
                type="button"
                className={`ansi-row-height-btn ${rowHeight === 'fixed' ? 'active' : ''}`}
                onClick={onRowHeightFixed}
              >
                {fixedRowHeight}px
              </button>
              <button
                type="button"
                className="ansi-row-height-btn"
                onClick={onRowHeightDecrement}
                disabled={rowHeight === 'auto'}
                title="Decrease row height"
              >
                −
              </button>
              <button
                type="button"
                className="ansi-row-height-btn"
                onClick={onRowHeightIncrement}
                disabled={rowHeight === 'auto'}
                title="Increase row height"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
