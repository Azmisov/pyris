import React, { memo } from 'react';

export interface ToggleSwitchOption {
  value: string;
  label: string;
}

interface ToggleSwitchProps {
  options: [ToggleSwitchOption, ToggleSwitchOption];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * A unified toggle switch component for switching between two options
 */
export const ToggleSwitch = memo<ToggleSwitchProps>(({ options, value, onChange, className = '' }) => {
  const [option1, option2] = options;
  const isFirstSelected = value === option1.value;

  return (
    <div className={`ansi-toggle-switch ${className}`}>
      <button
        type="button"
        className={`ansi-toggle-option ${isFirstSelected ? 'active' : ''}`}
        onClick={() => onChange(option1.value)}
        aria-pressed={isFirstSelected}
      >
        {option1.label}
      </button>
      <button
        type="button"
        className={`ansi-toggle-option ${!isFirstSelected ? 'active' : ''}`}
        onClick={() => onChange(option2.value)}
        aria-pressed={!isFirstSelected}
      >
        {option2.label}
      </button>
    </div>
  );
});

ToggleSwitch.displayName = 'ToggleSwitch';
