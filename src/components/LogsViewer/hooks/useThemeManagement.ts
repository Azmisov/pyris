import { useState, useEffect } from 'react';
import { applyPaletteTheme } from '../../../theme/cssVars';
import { getActiveColorScheme, getEffectiveThemeMode } from '../../../theme/colorSchemes';

export function useThemeManagement(
  themeMode: 'dark' | 'light' | 'system',
  darkTheme: string,
  lightTheme: string
) {
  const [effectiveThemeMode, setEffectiveThemeMode] = useState<'dark' | 'light'>(() =>
    getEffectiveThemeMode(themeMode)
  );

  // Apply theme with selected color scheme
  useEffect(() => {
    try {
      const activeScheme = getActiveColorScheme(themeMode, darkTheme, lightTheme);
      const effectiveMode = getEffectiveThemeMode(themeMode);
      setEffectiveThemeMode(effectiveMode);
      applyPaletteTheme(effectiveMode, activeScheme);
    } catch (err) {
      console.warn('Failed to apply palette theme:', err);
    }
  }, [themeMode, darkTheme, lightTheme]);

  // Listen for system theme changes if mode is 'system'
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
