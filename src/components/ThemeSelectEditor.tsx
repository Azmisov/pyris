import React from 'react';
import { StandardEditorProps } from '@grafana/data';
import { ThemeSelect } from './ThemeSelect';
import { getDarkColorSchemeOptions, getLightColorSchemeOptions } from '../theme/colorSchemes';

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

  return (
    <ThemeSelect
      options={options}
      value={value}
      onChange={onChange}
    />
  );
};
