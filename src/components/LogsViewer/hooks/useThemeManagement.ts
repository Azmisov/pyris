import { useState, useEffect } from 'react';
import { useTheme2 } from '@grafana/ui';
import { applyTheme, applyPalette } from '../../../theme/cssVars';
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

  // Initialize fixed palette styles once on mount
  useEffect(applyPalette, []); // Empty deps - only run once on mount

  // Set data-ansi-theme on body for global theme-aware styling (e.g., shadows on portaled elements)
  useEffect(() => {
    document.body.setAttribute('data-ansi-theme', effectiveThemeMode);
    return () => {
      document.body.removeAttribute('data-ansi-theme');
    };
  }, [effectiveThemeMode]);

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
      applyTheme(activeScheme);
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
        applyTheme(activeScheme);
      } catch (err) {
        console.warn('Failed to apply palette theme on system change:', err);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    return undefined;
  }, [themeMode, darkTheme, lightTheme]);

  return effectiveThemeMode;
}
