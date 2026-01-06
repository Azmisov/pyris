import React, { memo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './Copyable.module.css';

/**
 * Hook for managing copy-to-clipboard with toast notification
 */
export function useCopyToast() {
  const [toastPosition, setToastPosition] = useState<{ x: number; y: number } | null>(null);

  const copyWithToast = useCallback(async (text: string, e: React.MouseEvent) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastPosition({ x: e.clientX, y: e.clientY });
      setTimeout(() => setToastPosition(null), 1500);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }, []);

  const Toast = toastPosition ? createPortal(
    <span
      className={styles.copyToast}
      style={{
        position: 'fixed',
        left: `${toastPosition.x}px`,
        top: `${toastPosition.y}px`,
        transform: 'translate(-50%, calc(-100% - 4px))',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      Copied!
    </span>,
    document.body
  ) : null;

  return { copyWithToast, Toast };
}

/**
 * Format a value for copying to clipboard
 */
export function formatValueForCopy(value: any): string {
  if (value === null) {
    return 'null';
  } else if (typeof value === 'string') {
    return value; // No quotes for strings
  } else if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  } else {
    return JSON.stringify(value);
  }
}

interface CopyableValueProps {
  /** The value to display and copy */
  value: any;
  /** Optional custom display content (defaults to formatted value) */
  children?: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
  /** Whether copying is enabled */
  enabled?: boolean;
}

/**
 * A component that displays a value and allows clicking to copy it.
 * Reusable copy-on-click with toast notification.
 */
export const CopyableValue = memo<CopyableValueProps>(({
  value,
  children,
  className = '',
  enabled = true,
}) => {
  const { copyWithToast, Toast } = useCopyToast();

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!enabled) {return;}
    e.stopPropagation();
    const copyText = formatValueForCopy(value);
    copyWithToast(copyText, e);
  }, [value, enabled, copyWithToast]);

  const displayContent = children ?? formatValueForCopy(value);

  return (
    <>
      <span
        className={`${enabled ? styles.copyable : ''} ${className}`.trim()}
        onClick={enabled ? handleClick : undefined}
        title={enabled ? 'Click to copy' : undefined}
      >
        {displayContent}
      </span>
      {Toast}
    </>
  );
});

CopyableValue.displayName = 'CopyableValue';
