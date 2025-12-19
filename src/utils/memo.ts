import { ProcessedLogRow, LogsPanelOptions } from '../types';

// Simple hash function for stable memoization keys
function simpleHash(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

// Create stable hash from message and relevant options
export function createMemoKey(message: string, options: LogsPanelOptions): string {
  // Only include options that affect HTML output
  // Bold/Italic/Underline are CSS-only and don't affect caching
  // Hyperlinks are always enabled
  const relevantOptions = {
    wrapMode: options.wrapMode,
    maxLineLength: options.maxLineLength,
  };

  const optionsStr = JSON.stringify(relevantOptions);
  const combined = `${message}|${optionsStr}`;

  return simpleHash(combined);
}

// LRU Cache implementation for processed log rows
export class ProcessedRowCache {
  private cache = new Map<string, ProcessedLogRow>();
  private maxSize: number;
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): ProcessedLogRow | undefined {
    const item = this.cache.get(key);
    if (item) {
      // Update access order
      this.accessOrder.set(key, ++this.accessCounter);
      return item;
    }
    return undefined;
  }

  set(key: string, value: ProcessedLogRow): void {
    // If cache is full, remove least recently used item
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, value);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  size(): number {
    return this.cache.size;
  }

  // Get cache statistics
  getStats(): {
    size: number;
    maxSize: number;
    hitRatio: number;
    totalAccesses: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRatio: this.hitRatio,
      totalAccesses: this.totalAccesses,
    };
  }

  private evictLRU(): void {
    if (this.accessOrder.size === 0) return;

    // Find least recently used item
    let lruKey = '';
    let lruAccess = Infinity;

    for (const [key, access] of this.accessOrder) {
      if (access < lruAccess) {
        lruAccess = access;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
    }
  }

  private hitCount = 0;
  private totalAccesses = 0;

  private get hitRatio(): number {
    return this.totalAccesses > 0 ? this.hitCount / this.totalAccesses : 0;
  }

  // Override get to track hits
  getWithStats(key: string): ProcessedLogRow | undefined {
    this.totalAccesses++;
    const result = this.get(key);
    if (result) {
      this.hitCount++;
    }
    return result;
  }
}

// Global cache instance
let globalCache: ProcessedRowCache | null = null;

// Get or create global cache
export function getGlobalCache(): ProcessedRowCache {
  if (!globalCache) {
    globalCache = new ProcessedRowCache(2000); // Larger cache for global use
  }
  return globalCache;
}

// Cache cleanup utility
export function cleanupCaches(): void {
  if (globalCache) {
    globalCache.clear();
  }
}