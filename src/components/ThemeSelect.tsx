import React, { memo, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { ColorSwatch } from './ColorSwatch';
import { getColorScheme } from '../theme/colorSchemes';
import { useThemeVars } from '../theme/ThemeVarsContext';
import styles from './ThemeSelect.module.css';

// DEBUG: Set to true to keep dropdown open for inspection
const DEBUG_KEEP_OPEN = false;

export interface ThemeOption {
  value: string;
  label: string;
  /** Optional override: key of the ColorScheme to use for the swatch. Defaults to `value`. */
  schemeKey?: string;
}

// Sentinel to indicate the theme matching the panel's default
export const PANEL_DEFAULT_THEME_VALUE = '__panel_default__';

interface ThemeSelectProps {
  options: ThemeOption[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

/**
 * Custom theme selector with visual color palette swatches
 * Uses Radix UI Select for accessibility and proper portal support
 */
export const ThemeSelect = memo<ThemeSelectProps>(({ options, value, onChange, id }) => {
  const selectedItem = options.find(opt => opt.value === value);
  const displayItem = selectedItem || options[0];
  const [debugOpen, _setDebugOpen] = useState(DEBUG_KEEP_OPEN);
  const themeVars = useThemeVars();

  return (
    <div className={styles.container}>
      <Select.Root
        value={value}
        onValueChange={onChange}
        open={DEBUG_KEEP_OPEN ? debugOpen : undefined}
        onOpenChange={DEBUG_KEEP_OPEN ? undefined : undefined}
      >
        <Select.Trigger
          className={styles.button}
          id={id}
          aria-label="Select theme"
        >
          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            {displayItem && (
              <>
                <ColorSwatch scheme={getColorScheme(displayItem.schemeKey ?? displayItem.value)} />
                <span
                  className={styles.label}
                  style={displayItem.value === PANEL_DEFAULT_THEME_VALUE ? { fontStyle: 'italic' } : undefined}
                >
                  {displayItem.label}
                </span>
              </>
            )}
          </div>
          <Select.Icon asChild>
            <span className={styles.arrow}>▼</span>
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className={`${styles.menu} ${styles.open}`}
            style={themeVars as React.CSSProperties}
            position="popper"
            sideOffset={2}
            align="start"
            collisionPadding={8}
            avoidCollisions={true}
          >
            <Select.Viewport>
              {options.map((item) => (
                <Select.Item
                  key={item.value}
                  value={item.value}
                  className={styles.item}
                >
                  <ColorSwatch scheme={getColorScheme(item.schemeKey ?? item.value)} />
                  <Select.ItemText asChild>
                    <span
                      className={styles.itemLabel}
                      style={item.value === PANEL_DEFAULT_THEME_VALUE ? { fontStyle: 'italic' } : undefined}
                    >
                      {item.label}
                    </span>
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
});

ThemeSelect.displayName = 'ThemeSelect';
