import { useState, useEffect, useCallback } from 'react';

const STORAGE_PREFIX = 'grafana.plugin.ansi-logs-panel';

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
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }
}

/**
 * Custom hook for managing localStorage-synced state
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => getStorageItem(key, defaultValue));

  const setStorageState = useCallback((value: T | ((prev: T) => T)) => {
    setState(value);
  }, []);

  useEffect(() => {
    setStorageItem(key, state);
  }, [key, state]);

  return [state, setStorageState];
}
