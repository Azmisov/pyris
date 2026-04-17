import React, { useMemo } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { ThemeSelect } from './ThemeSelect';
import { getDarkColorSchemeOptions, getLightColorSchemeOptions } from '../theme/colorSchemes';
import { generateThemeVars } from '../theme/cssVars';
import { ThemeVarsContext } from '../theme/ThemeVarsContext';

interface ThemeSelectSettings {
  themeMode?: 'dark' | 'light';
}

/**
 * Custom panel editor component for theme selection
 * Wraps ThemeSelect component for use in Grafana panel options
 */
export const ThemeSelectEditor: React.FC<StandardEditorProps<string, ThemeSelectSettings>> = ({ value, onChange, item }) => {
  const themeMode = item.settings?.themeMode || 'dark';
  const options = themeMode === 'dark' ? getDarkColorSchemeOptions() : getLightColorSchemeOptions();
  // Rendered outside LogsViewer's ThemeVarsContext.Provider, so provide our own
  // based on the currently selected value (with inline style for the non-portaled button).
  const themeVars = useMemo(() => generateThemeVars(value), [value]);

  return (
    <ThemeVarsContext.Provider value={themeVars}>
      <div style={themeVars as React.CSSProperties}>
        <ThemeSelect
          options={options}
          value={value}
          onChange={onChange}
        />
      </div>
    </ThemeVarsContext.Provider>
  );
};
