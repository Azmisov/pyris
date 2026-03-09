import { createContext, useContext } from 'react';

/**
 * Context for CSS theme variables.
 * Portaled elements (Radix dropdowns, toasts) that render outside the plugin
 * container need these variables applied as inline styles to resolve
 * var(--logs-*) and var(--ansi-color-*) references.
 */
export const ThemeVarsContext = createContext<Record<string, string>>({});

export const useThemeVars = () => useContext(ThemeVarsContext);
