/**
 * Memory management utilities for the MCP server
 * Provides memory monitoring, leak detection, and resource cleanup
 */

import { EventEmitter } from 'events';

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  timestamp: number;
}

export interface MemoryOptions {
  warningThreshold: number; // MB
  criticalThreshold: number; // MB
  monitoringInterval: number; // ms
  gcSuggestionThreshold: number; // MB
}

export class MemoryManager extends EventEmitter {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private resourceCleanupCallbacks: Set<() => void> = new Set();
  private memoryHistory: MemoryStats[] = [];
  private readonly maxHistorySize = 100;

  constructor(private options: MemoryOptions) {
    super();
    this.setupMemoryMonitoring();
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.options.monitoringInterval);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Register a cleanup callback to be called when resources need to be freed
   */
  registerCleanupCallback(callback: () => void): void {
    this.resourceCleanupCallbacks.add(callback);
  }

  /**
   * Unregister a cleanup callback
   */
  unregisterCleanupCallback(callback: () => void): void {
    this.resourceCleanupCallbacks.delete(callback);
  }

  /**
   * Get current memory statistics
   */
  getCurrentMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      timestamp: Date.now(),
    };
  }

  /**
   * Get memory usage history
   */
  getMemoryHistory(): MemoryStats[] {
    return [...this.memoryHistory];
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
      this.emit('gc-forced');
    }
  }

  /**
   * Execute all registered cleanup callbacks
   */
  executeCleanup(): void {
    for (const callback of this.resourceCleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        this.emit('cleanup-error', error);
      }
    }
    this.emit('cleanup-executed', this.resourceCleanupCallbacks.size);
  }

  /**
   * Detect potential memory leaks by analyzing memory growth patterns
   */
  detectMemoryLeaks(): boolean {
    if (this.memoryHistory.length < 10) {
      return false;
    }

    const recent = this.memoryHistory.slice(-10);
    const growthPattern = recent.every((stat, index) => {
      if (index === 0) return true;
      return stat.heapUsed > recent[index - 1].heapUsed;
    });

    const totalGrowth = recent[recent.length - 1].heapUsed - recent[0].heapUsed;
    const significantGrowth = totalGrowth > 50; // 50MB growth in last 10 samples

    return growthPattern && significantGrowth;
  }

  /**
   * Clean up resources and stop monitoring
   */
  destroy(): void {
    this.stopMonitoring();
    this.executeCleanup();
    this.resourceCleanupCallbacks.clear();
    this.memoryHistory = [];
    this.removeAllListeners();
  }

  private setupMemoryMonitoring(): void {
    // Monitor for process warnings
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning' || 
          warning.message.includes('memory')) {
        this.emit('memory-warning', warning);
      }
    });

    // Handle uncaught exceptions related to memory
    process.on('uncaughtException', (error) => {
      if (error.message.includes('heap') || error.message.includes('memory')) {
        this.emit('memory-error', error);
      }
    });
  }

  private checkMemoryUsage(): void {
    const stats = this.getCurrentMemoryStats();
    
    // Add to history
    this.memoryHistory.push(stats);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }

    // Check thresholds
    if (stats.heapUsed > this.options.criticalThreshold) {
      this.emit('memory-critical', stats);
      this.executeCleanup();
    } else if (stats.heapUsed > this.options.warningThreshold) {
      this.emit('memory-warning', stats);
    }

    // Suggest GC if memory usage is high
    if (stats.heapUsed > this.options.gcSuggestionThreshold) {
      this.emit('gc-suggested', stats);
      this.forceGarbageCollection();
    }

    // Check for memory leaks
    if (this.detectMemoryLeaks()) {
      this.emit('memory-leak-detected', stats);
    }

    this.emit('memory-stats', stats);
  }
}

// Default memory manager instance
export const defaultMemoryOptions: MemoryOptions = {
  warningThreshold: 100, // 100MB
  criticalThreshold: 200, // 200MB
  monitoringInterval: 5000, // 5 seconds
  gcSuggestionThreshold: 150, // 150MB
};

export function createMemoryManager(options?: Partial<MemoryOptions>): MemoryManager {
  const finalOptions = { ...defaultMemoryOptions, ...options };
  return new MemoryManager(finalOptions);
}