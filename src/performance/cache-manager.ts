/**
 * Cache management utilities for the MCP server
 * Provides LRU caching for tool responses, schema validation, and frequently accessed data
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheOptions {
  maxSize: number;
  maxAge: number; // milliseconds
  cleanupInterval: number; // milliseconds
}

/**
 * Simple LRU Cache implementation without external dependencies
 */
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Set<string>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private options: CacheOptions) {
    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      return undefined;
    }

    // Update access information
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    // Update LRU order
    this.accessOrder.delete(key);
    this.accessOrder.add(key);

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    const now = Date.now();

    // If key exists, update it
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.timestamp = now;
      entry.lastAccessed = now;
      entry.accessCount = 1;
      
      // Update LRU order
      this.accessOrder.delete(key);
      this.accessOrder.add(key);
      return;
    }

    // Check if we need to evict
    if (this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
    });

    this.accessOrder.add(key);
  }

  /**
   * Delete key from cache
   */
  delete(key: string): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; accessCount: number; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      accessCount: entry.accessCount,
      age: now - entry.timestamp,
    }));

    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const hitRate = totalAccesses > 0 ? entries.length / totalAccesses : 0;

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate,
      entries,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }

    return keysToDelete.length;
  }

  /**
   * Destroy cache and clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.options.maxAge;
  }

  private evictLRU(): void {
    // Get the least recently used key (first in the set)
    const lruKey = this.accessOrder.values().next().value;
    if (lruKey) {
      this.delete(lruKey);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }
}

/**
 * Cache manager for different types of cached data
 */
export class CacheManager {
  private toolResponseCache: LRUCache<any>;
  private schemaValidationCache: LRUCache<any>;
  private generalDataCache: LRUCache<any>;

  constructor() {
    this.toolResponseCache = new LRUCache({
      maxSize: 100,
      maxAge: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
    });

    this.schemaValidationCache = new LRUCache({
      maxSize: 50,
      maxAge: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
    });

    this.generalDataCache = new LRUCache({
      maxSize: 200,
      maxAge: 10 * 60 * 1000, // 10 minutes
      cleanupInterval: 2 * 60 * 1000, // 2 minutes
    });
  }

  /**
   * Cache tool response
   */
  cacheToolResponse(toolName: string, args: any, response: any): void {
    const key = this.createToolCacheKey(toolName, args);
    this.toolResponseCache.set(key, response);
  }

  /**
   * Get cached tool response
   */
  getCachedToolResponse(toolName: string, args: any): any | undefined {
    const key = this.createToolCacheKey(toolName, args);
    return this.toolResponseCache.get(key);
  }

  /**
   * Cache schema validation result
   */
  cacheSchemaValidation(schema: string, data: any, result: any): void {
    const key = this.createSchemaValidationKey(schema, data);
    this.schemaValidationCache.set(key, result);
  }

  /**
   * Get cached schema validation result
   */
  getCachedSchemaValidation(schema: string, data: any): any | undefined {
    const key = this.createSchemaValidationKey(schema, data);
    return this.schemaValidationCache.get(key);
  }

  /**
   * Cache general data
   */
  cacheData(key: string, data: any): void {
    this.generalDataCache.set(key, data);
  }

  /**
   * Get cached general data
   */
  getCachedData(key: string): any | undefined {
    return this.generalDataCache.get(key);
  }

  /**
   * Get overall cache statistics
   */
  getOverallStats(): {
    toolResponses: ReturnType<LRUCache<any>['getStats']>;
    schemaValidation: ReturnType<LRUCache<any>['getStats']>;
    generalData: ReturnType<LRUCache<any>['getStats']>;
  } {
    return {
      toolResponses: this.toolResponseCache.getStats(),
      schemaValidation: this.schemaValidationCache.getStats(),
      generalData: this.generalDataCache.getStats(),
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.toolResponseCache.clear();
    this.schemaValidationCache.clear();
    this.generalDataCache.clear();
  }

  /**
   * Destroy all caches and clean up resources
   */
  destroy(): void {
    this.toolResponseCache.destroy();
    this.schemaValidationCache.destroy();
    this.generalDataCache.destroy();
  }

  private createToolCacheKey(toolName: string, args: any): string {
    return `tool:${toolName}:${this.hashObject(args)}`;
  }

  private createSchemaValidationKey(schema: string, data: any): string {
    return `schema:${this.hashString(schema)}:${this.hashObject(data)}`;
  }

  private hashObject(obj: any): string {
    try {
      const str = JSON.stringify(obj, Object.keys(obj).sort());
      return this.hashString(str);
    } catch {
      return String(obj);
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }
}

// Default cache manager instance
export const defaultCacheManager = new CacheManager();