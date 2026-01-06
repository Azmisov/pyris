import React, { useRef, useEffect } from 'react';
import { ThemeSelect } from '../ThemeSelect';
import SettingsIcon from '../../icons/settings.svg';
import styles from './SettingsDropdown.module.css';
import toolbarStyles from '../toolbar.module.css';
import sharedStyles from '../../shared.module.css';

interface SettingsDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
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
    if (!isOpen) {return;}

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is inside settings container
      if (settingsRef.current && settingsRef.current.contains(target)) {
        return;
      }

      // Check if click is on Radix Select portaled content
      // Radix UI portals the content to document.body, so we need to check for it
      const clickedElement = target instanceof Element ? target : null;
      if (clickedElement) {
        // Check if the clicked element or any parent is part of Radix Select
        const isRadixSelectContent = clickedElement.closest('[data-radix-select-content]');
        const isRadixSelectViewport = clickedElement.closest('[data-radix-select-viewport]');
        const isRadixSelectItem = clickedElement.closest('[data-radix-select-item]');

        if (isRadixSelectContent || isRadixSelectViewport || isRadixSelectItem) {
          return;
        }
      }

      // Click is outside - close the dropdown
      onToggle();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div className={styles.container} ref={settingsRef}>
      <button
        onClick={onToggle}
        className={`${toolbarStyles.button} ${isOpen ? toolbarStyles.active : ''}`}
        title="Settings"
        aria-label="Settings"
      >
        <SettingsIcon />
      </button>
      {isOpen && (
        <div className={`${styles.dropdown} ${sharedStyles.shadowed}`}>
          <div className={styles.item}>
            <label htmlFor="theme-mode">Light/Dark Preference</label>
            <select
              key={`theme-mode-${themeMode}`}
              id="theme-mode"
              defaultValue={themeMode}
              onChange={onThemeModeChange}
            >
              <option value="grafana">Grafana</option>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div className={styles.item}>
            <label htmlFor="theme">{effectiveThemeMode === 'dark' ? 'Dark' : 'Light'} Theme</label>
            <ThemeSelect
              id="theme"
              options={availableThemeOptions}
              value={currentTheme}
              onChange={onThemeChange}
            />
          </div>
          <div className={styles.item}>
            <label htmlFor="row-height">Row Height</label>
            <div className={styles.rowHeightGroup}>
              <button
                type="button"
                className={`${styles.rowHeightBtn} ${rowHeight === 'auto' ? styles.active : ''}`}
                onClick={onRowHeightAuto}
              >
                Auto
              </button>
              <button
                type="button"
                className={`${styles.rowHeightBtn} ${rowHeight === 'fixed' ? styles.active : ''}`}
                onClick={onRowHeightFixed}
              >
                {fixedRowHeight}px
              </button>
              <button
                type="button"
                className={styles.rowHeightBtn}
                onClick={onRowHeightDecrement}
                disabled={rowHeight === 'auto'}
                title="Decrease row height"
              >
                −
              </button>
              <button
                type="button"
                className={styles.rowHeightBtn}
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
