import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_PREFIX = 'grafana.plugin.nyrix-pyris-panel';
const STORAGE_CHANGE_EVENT = 'nyrix-logs-storage-change';

function getStoredValue<T>(key: string): T | undefined {
  try {
    const item = localStorage.getItem(`${STORAGE_PREFIX}.${key}`);
    return item !== null ? (JSON.parse(item) as T) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Remove a key from localStorage without going through the hook. Broadcasts a
 * reset event so any mounted `useLocalStorage` reading the same key clears its
 * stored state and falls back to its defaultValue.
 */
export function clearStorageKey(key: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}.${key}`);
    const event = new CustomEvent(STORAGE_CHANGE_EVENT, {
      detail: { key: `${STORAGE_PREFIX}.${key}`, value: null }
    });
    window.dispatchEvent(event);
  } catch (err) {
    console.warn('Failed to clear localStorage:', err);
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
 * localStorage-synced state with a live fallback to `defaultValue`.
 * If no stored value exists, `defaultValue` is returned and changes to it
 * propagate — nothing is written to localStorage until the setter is called.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void, boolean] {
  const [stored, setStored] = useState<T | undefined>(() => getStoredValue<T>(key));

  // Re-read from storage when key changes (e.g. theme scope flipped per-panel <-> global)
  const lastKeyRef = useRef(key);
  useEffect(() => {
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key;
      setStored(getStoredValue<T>(key));
    }
  }, [key]);

  const value = stored !== undefined ? stored : defaultValue;
  const isStored = stored !== undefined;

  const setStorageState = useCallback((v: T | ((prev: T) => T)) => {
    setStored(prev => {
      const current = prev !== undefined ? prev : defaultValue;
      const next = typeof v === 'function' ? (v as (p: T) => T)(current) : v;
      setStorageItem(key, next);
      return next;
    });
  }, [key, defaultValue]);

  const clearStorageState = useCallback(() => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}.${key}`);
      const event = new CustomEvent(STORAGE_CHANGE_EVENT, {
        detail: { key: `${STORAGE_PREFIX}.${key}`, value: null }
      });
      window.dispatchEvent(event);
    } catch (err) {
      console.warn('Failed to clear localStorage:', err);
    }
    setStored(undefined);
  }, [key]);

  useEffect(() => {
    const fullKey = `${STORAGE_PREFIX}.${key}`;

    // Handle storage event from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === fullKey) {
        if (e.newValue === null) {
          setStored(undefined);
          return;
        }
        try {
          setStored(JSON.parse(e.newValue) as T);
        } catch (err) {
          console.warn('Failed to parse localStorage change:', err);
        }
      }
    };

    // Handle custom event from other instances in same window
    const handleCustomStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string; value: string | null }>;
      if (customEvent.detail.key === fullKey) {
        if (customEvent.detail.value === null) {
          setStored(undefined);
          return;
        }
        try {
          setStored(JSON.parse(customEvent.detail.value) as T);
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

  return [value, setStorageState, clearStorageState, isStored];
}
