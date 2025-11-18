import {
  COLOR_SCHEMES,
  getDarkColorSchemes,
  getLightColorSchemes,
  getActiveColorScheme,
  getEffectiveThemeMode,
} from './colorSchemes';

describe('Color Schemes', () => {
  describe('Theme Classification', () => {
    test('All themes have dark property', () => {
      Object.values(COLOR_SCHEMES).forEach(scheme => {
        expect(scheme).toHaveProperty('dark');
        expect(typeof scheme.dark).toBe('boolean');
      });
    });

    test('Dark and light themes are properly filtered', () => {
      const darkSchemes = getDarkColorSchemes();
      const lightSchemes = getLightColorSchemes();

      // Verify all dark themes have dark=true
      Object.values(darkSchemes).forEach(scheme => {
        expect(scheme.dark).toBe(true);
      });

      // Verify all light themes have dark=false
      Object.values(lightSchemes).forEach(scheme => {
        expect(scheme.dark).toBe(false);
      });

      // Verify total count matches
      const totalThemes = Object.keys(COLOR_SCHEMES).length;
      const darkCount = Object.keys(darkSchemes).length;
      const lightCount = Object.keys(lightSchemes).length;

      expect(darkCount + lightCount).toBe(totalThemes);
    });

    test('Known themes are classified correctly', () => {
      // Dark themes
      expect(COLOR_SCHEMES['nord']?.dark).toBe(true);
      expect(COLOR_SCHEMES['dracula']?.dark).toBe(true);
      expect(COLOR_SCHEMES['gruvbox-dark']?.dark).toBe(true);

      // Light themes
      expect(COLOR_SCHEMES['solarized-light']?.dark).toBe(false);
      expect(COLOR_SCHEMES['gruvbox']?.dark).toBe(false);
      expect(COLOR_SCHEMES['gruvbox-material-light']?.dark).toBe(false);
    });
  });

  describe('Theme Selection', () => {
    test('getActiveColorScheme selects dark theme in dark mode', () => {
      const result = getActiveColorScheme('dark', 'nord', 'solarized-light');
      expect(result).toBe('nord');
    });

    test('getActiveColorScheme selects light theme in light mode', () => {
      const result = getActiveColorScheme('light', 'nord', 'solarized-light');
      expect(result).toBe('solarized-light');
    });

    test('getActiveColorScheme falls back to first available theme if selected theme does not exist', () => {
      const result = getActiveColorScheme('dark', 'nonexistent-theme', 'solarized-light');
      const darkSchemes = getDarkColorSchemes();
      const firstDarkTheme = Object.keys(darkSchemes)[0];
      expect(result).toBe(firstDarkTheme);
    });

    test('getActiveColorScheme selects theme based on system preference', () => {
      // Mock system preference
      const originalMatchMedia = window.matchMedia;

      // Test dark system preference
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      const darkResult = getActiveColorScheme('system', 'nord', 'solarized-light');
      expect(darkResult).toBe('nord');

      // Test light system preference
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: light)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      const lightResult = getActiveColorScheme('system', 'nord', 'solarized-light');
      expect(lightResult).toBe('solarized-light');

      // Restore
      window.matchMedia = originalMatchMedia;
    });
  });

  describe('Theme Mode Detection', () => {
    test('getEffectiveThemeMode returns dark for dark mode', () => {
      expect(getEffectiveThemeMode('dark')).toBe('dark');
    });

    test('getEffectiveThemeMode returns light for light mode', () => {
      expect(getEffectiveThemeMode('light')).toBe('light');
    });

    test('getEffectiveThemeMode detects system preference', () => {
      const originalMatchMedia = window.matchMedia;

      // Test dark system preference
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
      }));
      expect(getEffectiveThemeMode('system')).toBe('dark');

      // Test light system preference
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: light)',
        media: query,
      }));
      expect(getEffectiveThemeMode('system')).toBe('light');

      // Restore
      window.matchMedia = originalMatchMedia;
    });
  });

  describe('Theme Counts', () => {
    test('Has expected number of themes', () => {
      const total = Object.keys(COLOR_SCHEMES).length;
      expect(total).toBeGreaterThan(300); // Should have 361 themes
    });

    test('Has both dark and light themes', () => {
      const darkCount = Object.keys(getDarkColorSchemes()).length;
      const lightCount = Object.keys(getLightColorSchemes()).length;

      expect(darkCount).toBeGreaterThan(0);
      expect(lightCount).toBeGreaterThan(0);
    });
  });
});
