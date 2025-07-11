/**
 * Performance optimization module exports
 * Provides easy access to all performance utilities
 */

export * from './memory-manager';
export * from './cache-manager';
export * from './io-optimizer';
export * from './error-handler';
export * from './performance-monitor';

// Re-export commonly used instances
export {
  defaultCacheManager,
} from './cache-manager';

export {
  createMemoryManager,
  defaultMemoryOptions,
} from './memory-manager';

export {
  createIOOptimizer,
  defaultIOOptions,
  JSONOptimizer,
} from './io-optimizer';

export {
  defaultErrorHandler,
} from './error-handler';

export {
  globalPerformanceMonitor,
  measure,
} from './performance-monitor';