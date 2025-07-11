/**
 * Performance monitoring utilities for the MCP server
 * Provides comprehensive performance metrics collection and monitoring
 */

import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  // Timing metrics
  responseTime: number[];
  startupTime: number;
  
  // Resource metrics
  memoryUsage: number[];
  cpuUsage: number[];
  
  // Throughput metrics
  requestsPerSecond: number;
  totalRequests: number;
  
  // Error metrics
  errorRate: number;
  totalErrors: number;
  
  // Cache metrics
  cacheHitRate: number;
  cacheSize: number;
  
  // Custom metrics
  customMetrics: Record<string, number>;
  
  // Timestamps
  startTime: number;
  lastUpdate: number;
}

export interface PerformanceBenchmark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private activeBenchmarks = new Map<string, PerformanceBenchmark>();
  private completedBenchmarks: PerformanceBenchmark[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly maxHistorySize = 1000;

  constructor() {
    super();
    this.metrics = this.initializeMetrics();
    this.startMonitoring();
  }

  /**
   * Start a performance benchmark
   */
  startBenchmark(name: string, metadata?: Record<string, any>): void {
    const benchmark: PerformanceBenchmark = {
      name,
      startTime: performance.now(),
      metadata,
    };
    
    this.activeBenchmarks.set(name, benchmark);
  }

  /**
   * End a performance benchmark
   */
  endBenchmark(name: string): number | null {
    const benchmark = this.activeBenchmarks.get(name);
    if (!benchmark) {
      return null;
    }

    benchmark.endTime = performance.now();
    benchmark.duration = benchmark.endTime - benchmark.startTime;

    this.activeBenchmarks.delete(name);
    this.completedBenchmarks.push(benchmark);

    // Keep history size manageable
    if (this.completedBenchmarks.length > this.maxHistorySize) {
      this.completedBenchmarks.shift();
    }

    // Update response time metrics
    this.addResponseTime(benchmark.duration);

    this.emit('benchmark-completed', benchmark);
    return benchmark.duration;
  }

  /**
   * Record a request completion
   */
  recordRequest(duration: number, isError: boolean = false): void {
    this.metrics.totalRequests++;
    this.addResponseTime(duration);

    if (isError) {
      this.metrics.totalErrors++;
    }

    this.updateThroughputMetrics();
    this.emit('request-recorded', { duration, isError });
  }

  /**
   * Record cache statistics
   */
  recordCacheStats(hitRate: number, size: number): void {
    this.metrics.cacheHitRate = hitRate;
    this.metrics.cacheSize = size;
  }

  /**
   * Add custom metric
   */
  addCustomMetric(name: string, value: number): void {
    this.metrics.customMetrics[name] = value;
  }

  /**
   * Increment custom metric
   */
  incrementCustomMetric(name: string, increment: number = 1): void {
    this.metrics.customMetrics[name] = (this.metrics.customMetrics[name] || 0) + increment;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get benchmark statistics
   */
  getBenchmarkStats(): {
    activeBenchmarks: number;
    completedBenchmarks: number;
    averageDuration: number;
    recentBenchmarks: PerformanceBenchmark[];
  } {
    const recentBenchmarks = this.completedBenchmarks.slice(-10);
    const averageDuration = this.completedBenchmarks.length > 0
      ? this.completedBenchmarks.reduce((sum, b) => sum + (b.duration || 0), 0) / this.completedBenchmarks.length
      : 0;

    return {
      activeBenchmarks: this.activeBenchmarks.size,
      completedBenchmarks: this.completedBenchmarks.length,
      averageDuration,
      recentBenchmarks,
    };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    uptime: number;
    averageResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    memoryUsage: { current: number; average: number; peak: number };
    cachePerformance: { hitRate: number; size: number };
    customMetrics: Record<string, number>;
  } {
    const uptime = Date.now() - this.metrics.startTime;
    const avgResponseTime = this.metrics.responseTime.length > 0
      ? this.metrics.responseTime.reduce((sum, time) => sum + time, 0) / this.metrics.responseTime.length
      : 0;

    const memStats = this.calculateMemoryStats();

    return {
      uptime,
      averageResponseTime: avgResponseTime,
      requestsPerSecond: this.metrics.requestsPerSecond,
      errorRate: this.metrics.errorRate,
      memoryUsage: memStats,
      cachePerformance: {
        hitRate: this.metrics.cacheHitRate,
        size: this.metrics.cacheSize,
      },
      customMetrics: { ...this.metrics.customMetrics },
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const summary = this.getPerformanceSummary();
    const benchmarkStats = this.getBenchmarkStats();
    
    const lines = [
      '=== Performance Report ===',
      `Uptime: ${this.formatDuration(summary.uptime)}`,
      `Total Requests: ${this.metrics.totalRequests}`,
      `Requests/Second: ${summary.requestsPerSecond.toFixed(2)}`,
      `Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`,
      `Error Rate: ${(summary.errorRate * 100).toFixed(2)}%`,
      '',
      '--- Memory Usage ---',
      `Current: ${summary.memoryUsage.current}MB`,
      `Average: ${summary.memoryUsage.average}MB`,
      `Peak: ${summary.memoryUsage.peak}MB`,
      '',
      '--- Cache Performance ---',
      `Hit Rate: ${(summary.cachePerformance.hitRate * 100).toFixed(2)}%`,
      `Cache Size: ${summary.cachePerformance.size} entries`,
      '',
      '--- Benchmarks ---',
      `Completed: ${benchmarkStats.completedBenchmarks}`,
      `Average Duration: ${benchmarkStats.averageDuration.toFixed(2)}ms`,
      `Active: ${benchmarkStats.activeBenchmarks}`,
    ];

    if (Object.keys(summary.customMetrics).length > 0) {
      lines.push('', '--- Custom Metrics ---');
      for (const [name, value] of Object.entries(summary.customMetrics)) {
        lines.push(`${name}: ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics and benchmarks
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.activeBenchmarks.clear();
    this.completedBenchmarks = [];
    this.emit('metrics-reset');
  }

  /**
   * Stop monitoring and clean up
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.removeAllListeners();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      responseTime: [],
      startupTime: performance.now(),
      memoryUsage: [],
      cpuUsage: [],
      requestsPerSecond: 0,
      totalRequests: 0,
      errorRate: 0,
      totalErrors: 0,
      cacheHitRate: 0,
      cacheSize: 0,
      customMetrics: {},
      startTime: Date.now(),
      lastUpdate: Date.now(),
    };
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateSystemMetrics();
    }, 5000); // Update every 5 seconds
  }

  private updateSystemMetrics(): void {
    // Update memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    this.addMemoryUsage(memUsageMB);

    // Update CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    this.addCPUUsage(cpuPercent);

    this.metrics.lastUpdate = Date.now();
    this.emit('metrics-updated', this.metrics);
  }

  private addResponseTime(time: number): void {
    this.metrics.responseTime.push(time);
    if (this.metrics.responseTime.length > this.maxHistorySize) {
      this.metrics.responseTime.shift();
    }
  }

  private addMemoryUsage(usage: number): void {
    this.metrics.memoryUsage.push(usage);
    if (this.metrics.memoryUsage.length > this.maxHistorySize) {
      this.metrics.memoryUsage.shift();
    }
  }

  private addCPUUsage(usage: number): void {
    this.metrics.cpuUsage.push(usage);
    if (this.metrics.cpuUsage.length > this.maxHistorySize) {
      this.metrics.cpuUsage.shift();
    }
  }

  private updateThroughputMetrics(): void {
    // This is a simplified calculation - in production you'd want more sophisticated metrics
    const runtimeSeconds = (Date.now() - this.metrics.startTime) / 1000;
    this.metrics.requestsPerSecond = this.metrics.totalRequests / runtimeSeconds;
    this.metrics.errorRate = this.metrics.totalRequests > 0 
      ? this.metrics.totalErrors / this.metrics.totalRequests 
      : 0;
  }

  private calculateMemoryStats(): { current: number; average: number; peak: number } {
    if (this.metrics.memoryUsage.length === 0) {
      return { current: 0, average: 0, peak: 0 };
    }

    const current = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    const average = this.metrics.memoryUsage.reduce((sum, usage) => sum + usage, 0) / this.metrics.memoryUsage.length;
    const peak = Math.max(...this.metrics.memoryUsage);

    return { current, average, peak };
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor();

/**
 * Decorator for automatic performance monitoring
 */
export function monitor(target: any, propertyName: string, descriptor: PropertyDescriptor): void {
  const method = descriptor.value;

  descriptor.value = function (...args: any[]) {
    const benchmarkName = `${target.constructor.name}.${propertyName}`;
    globalPerformanceMonitor.startBenchmark(benchmarkName);

    try {
      const result = method.apply(this, args);
      
      // Handle async methods
      if (result && typeof result.then === 'function') {
        return result
          .then((value: any) => {
            globalPerformanceMonitor.endBenchmark(benchmarkName);
            return value;
          })
          .catch((error: any) => {
            globalPerformanceMonitor.endBenchmark(benchmarkName);
            globalPerformanceMonitor.recordRequest(0, true);
            throw error;
          });
      } else {
        globalPerformanceMonitor.endBenchmark(benchmarkName);
        return result;
      }
    } catch (error) {
      globalPerformanceMonitor.endBenchmark(benchmarkName);
      globalPerformanceMonitor.recordRequest(0, true);
      throw error;
    }
  };
}

/**
 * Performance measurement utility
 */
export class PerformanceMeasurer {
  private startTime: number;
  
  constructor(private name: string) {
    this.startTime = performance.now();
    globalPerformanceMonitor.startBenchmark(name);
  }

  end(): number {
    const duration = globalPerformanceMonitor.endBenchmark(this.name);
    return duration || (performance.now() - this.startTime);
  }
}

/**
 * Create a performance measurer
 */
export function measure(name: string): PerformanceMeasurer {
  return new PerformanceMeasurer(name);
}