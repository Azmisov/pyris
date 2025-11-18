import React, { memo, useRef, useEffect, useState } from 'react';
import { useSelect } from 'downshift';
import { ColorSwatch } from './ColorSwatch';
import { getColorScheme } from '../theme/colorSchemes';

export interface ThemeOption {
  value: string;
  label: string;
}

interface ThemeSelectProps {
  options: ThemeOption[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

/**
 * Custom theme selector with visual color palette swatches
 * Uses Downshift for keyboard navigation and accessibility
 */
export const ThemeSelect = memo<ThemeSelectProps>(({ options, value, onChange, id }) => {
  const selectedItem = options.find(opt => opt.value === value);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  const {
    isOpen,
    getToggleButtonProps,
    getMenuProps,
    highlightedIndex,
    getItemProps,
  } = useSelect({
    items: options,
    selectedItem: selectedItem || null,
    onSelectedItemChange: ({ selectedItem: newItem }) => {
      if (newItem) {
        onChange(newItem.value);
      }
    },
    itemToString: item => item?.label || '',
  });

  // Calculate menu position when it opens
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Fallback if no item is selected
  const displayItem = selectedItem || options[0];

  return (
    <div className="ansi-theme-select">
      <button
        type="button"
        {...getToggleButtonProps()}
        ref={buttonRef}
        className={`ansi-theme-select-button ${isOpen ? 'open' : ''}`}
        id={id}
      >
        {displayItem && (
          <>
            <ColorSwatch scheme={getColorScheme(displayItem.value)} />
            <span className="ansi-theme-select-label">{displayItem.label}</span>
          </>
        )}
        <span className="ansi-theme-select-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      <ul
        {...getMenuProps()}
        className={`ansi-theme-select-menu ${isOpen ? 'open' : ''}`}
        style={isOpen ? {
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
          minWidth: `${menuPosition.width}px`
        } : undefined}
      >
        {isOpen &&
          options.map((item, index) => (
            <li
              key={item.value}
              {...getItemProps({ item, index })}
              className={`ansi-theme-select-item ${
                highlightedIndex === index ? 'highlighted' : ''
              } ${selectedItem?.value === item.value ? 'selected' : ''}`}
            >
              <ColorSwatch scheme={getColorScheme(item.value)} />
              <span className="ansi-theme-select-item-label">{item.label}</span>
            </li>
          ))}
      </ul>
    </div>
  );
});

ThemeSelect.displayName = 'ThemeSelect';
