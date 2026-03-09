import { useState, useEffect, useMemo } from 'react';
import { useTheme2 } from '@grafana/ui';
import { generateThemeVars, generatePaletteVars } from '../../../theme/cssVars';
import { getActiveColorScheme, getEffectiveThemeMode } from '../../../theme/colorSchemes';

export function useThemeManagement(
  themeMode: 'grafana' | 'system' | 'light' | 'dark',
  darkTheme: string,
  lightTheme: string
) {
  const grafanaTheme = useTheme2();

  // Track system preference for 'system' mode (needs state to trigger re-render on OS change)
  const [systemMode, setSystemMode] = useState<'dark' | 'light'>(() => getEffectiveThemeMode('system'));

  useEffect(() => {
    if (themeMode !== 'system') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemMode(getEffectiveThemeMode('system'));

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    return undefined;
  }, [themeMode]);

  // Derive effective theme mode from all inputs
  const effectiveThemeMode = useMemo((): 'dark' | 'light' => {
    if (themeMode === 'grafana') {
      return grafanaTheme.isDark ? 'dark' : 'light';
    }
    if (themeMode === 'system') {
      return systemMode;
    }
    return themeMode;
  }, [themeMode, grafanaTheme.isDark, systemMode]);

  // Palette vars are static (colors 16-255), computed once
  const paletteVars = useMemo(() => generatePaletteVars(), []);

  // Theme vars change with theme selection
  const themeVars = useMemo(() => {
    const modeForScheme = themeMode === 'grafana' ? effectiveThemeMode : themeMode;
    const activeScheme = getActiveColorScheme(modeForScheme, darkTheme, lightTheme);
    return generateThemeVars(activeScheme);
  }, [effectiveThemeMode, themeMode, darkTheme, lightTheme]);

  // Combined CSS variables for the container element
  const cssVars = useMemo(
    () => ({ ...paletteVars, ...themeVars }),
    [paletteVars, themeVars]
  );

  return { effectiveThemeMode, cssVars };
}
