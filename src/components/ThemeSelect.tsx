import React, { memo, useRef, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const {
    isOpen,
    getToggleButtonProps,
    highlightedIndex,
  } = useSelect({
    items: options,
    selectedItem: selectedItem || null,
    onSelectedItemChange: ({ selectedItem: newItem }) => {
      console.log('ThemeSelect: onSelectedItemChange called with:', newItem);
      if (newItem) {
        onChange(newItem.value);
      }
    },
    itemToString: item => item?.label || '',
    environment: typeof window !== 'undefined' ? window : undefined,
  });

  // Calculate menu position when it opens - use layoutEffect for synchronous positioning
  useLayoutEffect(() => {
    if (isOpen && buttonRef.current) {
      const button = buttonRef.current;
      const buttonRect = button.getBoundingClientRect();

      // Use viewport coordinates directly since we're portaling to document.body with position:fixed
      const top = buttonRect.bottom + 2;
      const left = buttonRect.left;

      console.log('ThemeSelect: Button rect (viewport):', {
        top: buttonRect.top,
        bottom: buttonRect.bottom,
        left: buttonRect.left,
      });
      console.log('ThemeSelect: Calculated viewport position:', { top, left });

      const calculatedPosition = {
        top,
        left,
        width: buttonRect.width,
      };

      console.log('ThemeSelect: Final menu position:', calculatedPosition);
      setMenuPosition(calculatedPosition);
    } else {
      setMenuPosition(null);
    }
  }, [isOpen]);

  // Fallback if no item is selected
  const displayItem = selectedItem || options[0];

  // Get props and separate refs from other props
  const toggleButtonPropsRaw = getToggleButtonProps();

  // Extract refs and other props
  const { ref: toggleButtonRef, ...toggleButtonProps } = toggleButtonPropsRaw as any;

  // Merge button ref with Downshift's ref
  const mergedButtonRef = (node: HTMLButtonElement | null) => {
    buttonRef.current = node;
    if (typeof toggleButtonRef === 'function') {
      toggleButtonRef(node);
    } else if (toggleButtonRef) {
      toggleButtonRef.current = node;
    }
  };

  // Apply calculated position explicitly with inline styles
  // Using fixed positioning to viewport - portal to document.body ensures no transform ancestors
  const menuStyles: React.CSSProperties | undefined = menuPosition ? {
    position: 'fixed',
    top: `${menuPosition.top}px`,
    left: `${menuPosition.left}px`,
    minWidth: `${menuPosition.width}px`,
  } : undefined;

  // Log applied styles
  if (menuStyles) {
    console.log('ThemeSelect: Applying menu styles:', menuStyles);
  }

  // Create the menu element - manually handle selection since portal breaks Downshift
  const menuElement = isOpen && menuPosition ? (
    <ul
      role="listbox"
      className="ansi-theme-select-menu open"
      style={menuStyles}
    >
      {options.map((item, index) => (
        <li
          key={item.value}
          role="option"
          aria-selected={selectedItem?.value === item.value}
          onClick={() => {
            console.log('ThemeSelect: Item clicked:', item.label, item.value);
            onChange(item.value);
          }}
          onMouseEnter={() => {
            // Could update highlightedIndex here if needed
          }}
          className={`ansi-theme-select-item ${
            highlightedIndex === index ? 'highlighted' : ''
          } ${selectedItem?.value === item.value ? 'selected' : ''}`}
        >
          <ColorSwatch scheme={getColorScheme(item.value)} />
          <span className="ansi-theme-select-item-label">{item.label}</span>
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <>
      <div className="ansi-theme-select" ref={containerRef}>
        <button
          type="button"
          {...toggleButtonProps}
          ref={mergedButtonRef}
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
      </div>

      {/* Render menu via portal to document.body with position:fixed to extend beyond all containers */}
      {menuElement && typeof document !== 'undefined' && createPortal(menuElement, document.body)}
    </>
  );
});

ThemeSelect.displayName = 'ThemeSelect';
