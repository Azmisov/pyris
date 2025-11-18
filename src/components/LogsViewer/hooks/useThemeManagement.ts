import { useState, useEffect } from 'react';
import { useTheme2 } from '@grafana/ui';
import { applyPaletteTheme } from '../../../theme/cssVars';
import { getActiveColorScheme, getEffectiveThemeMode } from '../../../theme/colorSchemes';

export function useThemeManagement(
  themeMode: 'grafana' | 'system' | 'light' | 'dark',
  darkTheme: string,
  lightTheme: string
) {
  const grafanaTheme = useTheme2();

  const [effectiveThemeMode, setEffectiveThemeMode] = useState<'dark' | 'light'>(() =>
    themeMode === 'grafana' ? (grafanaTheme.isDark ? 'dark' : 'light') : getEffectiveThemeMode(themeMode)
  );

  // Apply theme with selected color scheme
  useEffect(() => {
    try {
      const effectiveMode = themeMode === 'grafana'
        ? (grafanaTheme.isDark ? 'dark' : 'light')
        : getEffectiveThemeMode(themeMode);
      // For getActiveColorScheme, map 'grafana' to the effective mode
      const modeForScheme = themeMode === 'grafana' ? effectiveMode : themeMode;
      const activeScheme = getActiveColorScheme(modeForScheme, darkTheme, lightTheme);
      setEffectiveThemeMode(effectiveMode);
      applyPaletteTheme(effectiveMode, activeScheme);
    } catch (err) {
      console.warn('Failed to apply palette theme:', err);
    }
  }, [themeMode, darkTheme, lightTheme, grafanaTheme.isDark]);

  // Listen for system theme changes if mode is 'system'
  // (Grafana theme changes are handled by the grafanaTheme.isDark dependency above)
  useEffect(() => {
    if (themeMode !== 'system') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      try {
        const activeScheme = getActiveColorScheme(themeMode, darkTheme, lightTheme);
        const effectiveMode = getEffectiveThemeMode(themeMode);
        setEffectiveThemeMode(effectiveMode);
        applyPaletteTheme(effectiveMode, activeScheme);
      } catch (err) {
        console.warn('Failed to apply palette theme on system change:', err);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }

    return undefined;
  }, [themeMode, darkTheme, lightTheme]);

  return effectiveThemeMode;
}
