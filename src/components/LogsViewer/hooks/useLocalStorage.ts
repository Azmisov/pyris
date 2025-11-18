import { useState, useEffect, useCallback } from 'react';

const STORAGE_PREFIX = 'grafana.plugin.ansi-logs-panel';
const STORAGE_CHANGE_EVENT = 'nyrix-logs-storage-change';

function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(`${STORAGE_PREFIX}.${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}.${key}`, JSON.stringify(value));

    // Dispatch custom event to notify other instances in the same window
    const event = new CustomEvent(STORAGE_CHANGE_EVENT, {
      detail: { key: `${STORAGE_PREFIX}.${key}`, value: JSON.stringify(value) }
    });
    window.dispatchEvent(event);
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }
}

/**
 * Custom hook for managing localStorage-synced state
 * Automatically synchronizes across all panel instances
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => getStorageItem(key, defaultValue));

  const setStorageState = useCallback((value: T | ((prev: T) => T)) => {
    setState(value);
  }, []);

  // Write to localStorage whenever state changes
  useEffect(() => {
    setStorageItem(key, state);
  }, [key, state]);

  // Listen for changes from other instances (same window) and other tabs
  useEffect(() => {
    const fullKey = `${STORAGE_PREFIX}.${key}`;

    // Handle storage event from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === fullKey && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue) as T;
          setState(newValue);
        } catch (err) {
          console.warn('Failed to parse localStorage change:', err);
        }
      }
    };

    // Handle custom event from other instances in same window
    const handleCustomStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string; value: string }>;
      if (customEvent.detail.key === fullKey) {
        try {
          const newValue = JSON.parse(customEvent.detail.value) as T;
          setState(newValue);
        } catch (err) {
          console.warn('Failed to parse custom storage change:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(STORAGE_CHANGE_EVENT, handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(STORAGE_CHANGE_EVENT, handleCustomStorageChange);
    };
  }, [key]);

  return [state, setStorageState];
}
