/**
 * I/O optimization utilities for the MCP server
 * Provides efficient stdio buffering, message batching, and JSON optimization
 */

import { Transform } from 'stream';

export interface IOOptions {
  bufferSize: number;
  flushInterval: number; // milliseconds
  batchSize: number;
  enableCompression: boolean;
}

/**
 * Optimized JSON operations
 */
export class JSONOptimizer {
  private static parseCache = new Map<string, any>();
  private static stringifyCache = new Map<any, string>();
  private static readonly maxCacheSize = 1000;

  /**
   * Fast JSON parsing with caching for repeated objects
   */
  static parse(json: string): unknown {
    // Check cache first
    if (this.parseCache.has(json)) {
      return this.parseCache.get(json);
    }

    const parsed = JSON.parse(json);
    
    // Cache if not too large
    if (this.parseCache.size < this.maxCacheSize) {
      this.parseCache.set(json, parsed);
    }
    
    return parsed;
  }

  /**
   * Fast JSON stringification with caching
   */
  static stringify(obj: unknown): string {
    // For simple objects, check cache
    const cacheKey = this.getCacheKey(obj);
    if (cacheKey && this.stringifyCache.has(cacheKey)) {
      return this.stringifyCache.get(cacheKey)!;
    }

    const stringified = JSON.stringify(obj);
    
    // Cache if not too large and cacheable
    if (cacheKey && this.stringifyCache.size < this.maxCacheSize) {
      this.stringifyCache.set(cacheKey, stringified);
    }
    
    return stringified;
  }

  /**
   * Clear caches
   */
  static clearCaches(): void {
    this.parseCache.clear();
    this.stringifyCache.clear();
  }

  private static getCacheKey(obj: unknown): string | null {
    // Only cache simple objects to avoid memory issues
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return null;
    }

    const keys = Object.keys(obj);
    if (keys.length > 10) {
      return null; // Too complex to cache
    }

    try {
      return JSON.stringify(obj, keys.sort());
    } catch {
      return null;
    }
  }
}

/**
 * Message batching for improved throughput
 */
export class MessageBatcher {
  private pendingMessages: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private onFlushCallback: (messages: string[]) => void;

  constructor(
    private options: IOOptions,
    onFlush: (messages: string[]) => void
  ) {
    this.onFlushCallback = onFlush;
  }

  /**
   * Add message to batch
   */
  addMessage(message: string): void {
    this.pendingMessages.push(message);

    // Auto-flush if batch is full
    if (this.pendingMessages.length >= this.options.batchSize) {
      this.flush();
    } else if (!this.flushTimer) {
      // Set timer for automatic flush
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, this.options.flushInterval);
    }
  }

  /**
   * Force flush all pending messages
   */
  flush(): void {
    if (this.pendingMessages.length === 0) {
      return;
    }

    const messagesToFlush = [...this.pendingMessages];
    this.pendingMessages = [];

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.onFlushCallback(messagesToFlush);
  }

  /**
   * Get number of pending messages
   */
  getPendingCount(): number {
    return this.pendingMessages.length;
  }

  /**
   * Destroy batcher and clean up
   */
  destroy(): void {
    this.flush();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

/**
 * Buffered stdio transform stream
 */
export class BufferedStdioTransform extends Transform {
  private buffer: Buffer = Buffer.alloc(0);
  private messageDelimiter = '\n';

  constructor(private options: IOOptions) {
    super({
      objectMode: false,
      highWaterMark: options.bufferSize,
    });
  }

  _transform(chunk: unknown, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    try {
      // Append to buffer
      this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk as string)]);

      // Process complete messages
      const completeMessages = this.extractCompleteMessages();
      
      for (const message of completeMessages) {
        this.push(message + this.messageDelimiter);
      }

      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  _flush(callback: (error?: Error | null) => void): void {
    try {
      // Process any remaining data in buffer
      if (this.buffer.length > 0) {
        this.push(this.buffer.toString() + this.messageDelimiter);
        this.buffer = Buffer.alloc(0);
      }
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  private extractCompleteMessages(): string[] {
    const bufferStr = this.buffer.toString();
    const lines = bufferStr.split(this.messageDelimiter);

    // Keep the last incomplete line in buffer
    const incompleteLastLine = lines.pop() || '';
    this.buffer = Buffer.from(incompleteLastLine);

    // Return complete lines
    return lines.filter(line => line.trim().length > 0);
  }
}

/**
 * I/O performance monitor
 */
export class IOPerformanceMonitor {
  private stats = {
    messagesProcessed: 0,
    bytesProcessed: 0,
    parseTime: 0,
    stringifyTime: 0,
    bufferHits: 0,
    bufferMisses: 0,
    startTime: Date.now(),
  };

  /**
   * Record message processing
   */
  recordMessageProcessed(sizeBytes: number): void {
    this.stats.messagesProcessed++;
    this.stats.bytesProcessed += sizeBytes;
  }

  /**
   * Record JSON parse time
   */
  recordParseTime(timeMs: number): void {
    this.stats.parseTime += timeMs;
  }

  /**
   * Record JSON stringify time
   */
  recordStringifyTime(timeMs: number): void {
    this.stats.stringifyTime += timeMs;
  }

  /**
   * Record buffer hit
   */
  recordBufferHit(): void {
    this.stats.bufferHits++;
  }

  /**
   * Record buffer miss
   */
  recordBufferMiss(): void {
    this.stats.bufferMisses++;
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    messagesPerSecond: number;
    bytesPerSecond: number;
    averageParseTime: number;
    averageStringifyTime: number;
    bufferHitRate: number;
    totalRuntime: number;
  } {
    const runtimeMs = Date.now() - this.stats.startTime;
    const runtimeSec = runtimeMs / 1000;

    return {
      messagesPerSecond: this.stats.messagesProcessed / runtimeSec,
      bytesPerSecond: this.stats.bytesProcessed / runtimeSec,
      averageParseTime: this.stats.messagesProcessed > 0 
        ? this.stats.parseTime / this.stats.messagesProcessed 
        : 0,
      averageStringifyTime: this.stats.messagesProcessed > 0
        ? this.stats.stringifyTime / this.stats.messagesProcessed
        : 0,
      bufferHitRate: (this.stats.bufferHits + this.stats.bufferMisses) > 0
        ? this.stats.bufferHits / (this.stats.bufferHits + this.stats.bufferMisses)
        : 0,
      totalRuntime: runtimeMs,
    };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = {
      messagesProcessed: 0,
      bytesProcessed: 0,
      parseTime: 0,
      stringifyTime: 0,
      bufferHits: 0,
      bufferMisses: 0,
      startTime: Date.now(),
    };
  }
}

/**
 * Main I/O optimizer class
 */
export class IOOptimizer {
  private performanceMonitor: IOPerformanceMonitor;
  private messageBatcher: MessageBatcher | null = null;

  constructor(private options: IOOptions) {
    this.performanceMonitor = new IOPerformanceMonitor();
  }

  /**
   * Create a message batcher
   */
  createMessageBatcher(onFlush: (messages: string[]) => void): MessageBatcher {
    this.messageBatcher = new MessageBatcher(this.options, onFlush);
    return this.messageBatcher;
  }

  /**
   * Create buffered stdio transform
   */
  createBufferedTransform(): BufferedStdioTransform {
    return new BufferedStdioTransform(this.options);
  }

  /**
   * Optimized JSON parse with monitoring
   */
  parseJSON(json: string): unknown {
    const startTime = Date.now();
    try {
      const result = JSONOptimizer.parse(json);
      this.performanceMonitor.recordParseTime(Date.now() - startTime);
      this.performanceMonitor.recordMessageProcessed(json.length);
      return result;
    } catch (error) {
      this.performanceMonitor.recordParseTime(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Optimized JSON stringify with monitoring
   */
  stringifyJSON(obj: unknown): string {
    const startTime = Date.now();
    try {
      const result = JSONOptimizer.stringify(obj);
      this.performanceMonitor.recordStringifyTime(Date.now() - startTime);
      this.performanceMonitor.recordMessageProcessed(result.length);
      return result;
    } catch (error) {
      this.performanceMonitor.recordStringifyTime(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): ReturnType<IOPerformanceMonitor['getStats']> {
    return this.performanceMonitor.getStats();
  }

  /**
   * Clear all caches and reset stats
   */
  reset(): void {
    JSONOptimizer.clearCaches();
    this.performanceMonitor.reset();
  }

  /**
   * Destroy optimizer and clean up resources
   */
  destroy(): void {
    if (this.messageBatcher) {
      this.messageBatcher.destroy();
      this.messageBatcher = null;
    }
    this.reset();
  }
}

// Default I/O options
export const defaultIOOptions: IOOptions = {
  bufferSize: 64 * 1024, // 64KB
  flushInterval: 10, // 10ms
  batchSize: 10,
  enableCompression: false,
};

export function createIOOptimizer(options?: Partial<IOOptions>): IOOptimizer {
  const finalOptions = { ...defaultIOOptions, ...options };
  return new IOOptimizer(finalOptions);
}