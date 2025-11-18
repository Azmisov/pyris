import React, { memo } from 'react';
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

  // Fallback if no item is selected
  const displayItem = selectedItem || options[0];

  return (
    <div className="ansi-theme-select">
      <button
        type="button"
        {...getToggleButtonProps()}
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
