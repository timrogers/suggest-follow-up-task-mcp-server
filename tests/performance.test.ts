/**
 * Performance-specific tests for the MCP server
 */

import { 
  LRUCache, 
  MemoryManager, 
  createMemoryManager,
  IOOptimizer,
  createIOOptimizer,
  JSONOptimizer,
  globalPerformanceMonitor,
  measure,
  ErrorHandlerManager,
} from '../src/performance/index';

describe('Performance Components', () => {
  describe('LRUCache', () => {
    let cache: LRUCache<string>;

    beforeEach(() => {
      cache = new LRUCache({
        maxSize: 3,
        maxAge: 1000, // 1 second
        cleanupInterval: 100,
      });
    });

    afterEach(() => {
      cache.destroy();
    });

    test('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('should evict LRU items when full', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Should evict key1

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    test('should expire items after maxAge', async () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(cache.get('key1')).toBeUndefined();
    });

    test('should provide cache statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // Hit
      cache.get('nonexistent'); // Miss (implicit)

      const stats = cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(3);
    });
  });

  describe('MemoryManager', () => {
    let memoryManager: MemoryManager;

    beforeEach(() => {
      memoryManager = createMemoryManager({
        warningThreshold: 50, // 50MB
        criticalThreshold: 100, // 100MB
        monitoringInterval: 100, // 100ms
        gcSuggestionThreshold: 75, // 75MB
      });
    });

    afterEach(() => {
      memoryManager.destroy();
    });

    test('should provide memory statistics', () => {
      const stats = memoryManager.getCurrentMemoryStats();
      expect(stats.heapUsed).toBeGreaterThan(0);
      expect(stats.heapTotal).toBeGreaterThan(0);
      expect(stats.rss).toBeGreaterThan(0);
      expect(stats.timestamp).toBeGreaterThan(0);
    });

    test('should register and execute cleanup callbacks', () => {
      let cleanupCalled = false;
      const cleanupCallback = () => {
        cleanupCalled = true;
      };

      memoryManager.registerCleanupCallback(cleanupCallback);
      memoryManager.executeCleanup();

      expect(cleanupCalled).toBe(true);
    });

    test('should detect memory usage patterns', () => {
      // This is a basic test - in real scenarios, memory leak detection
      // would require actual memory growth patterns
      const hasLeaks = memoryManager.detectMemoryLeaks();
      expect(typeof hasLeaks).toBe('boolean');
    });
  });

  describe('JSONOptimizer', () => {
    beforeEach(() => {
      JSONOptimizer.clearCaches();
    });

    afterEach(() => {
      JSONOptimizer.clearCaches();
    });

    test('should parse JSON correctly', () => {
      const json = '{"test": "value"}';
      const parsed = JSONOptimizer.parse(json);
      expect(parsed).toEqual({ test: 'value' });
    });

    test('should stringify objects correctly', () => {
      const obj = { test: 'value' };
      const stringified = JSONOptimizer.stringify(obj);
      expect(stringified).toBe('{"test":"value"}');
    });

    test('should cache repeated operations', () => {
      const json = '{"test": "value"}';
      
      // First parse
      const parsed1 = JSONOptimizer.parse(json);
      
      // Second parse (should use cache)
      const parsed2 = JSONOptimizer.parse(json);
      
      expect(parsed1).toEqual(parsed2);
    });
  });

  describe('IOOptimizer', () => {
    let ioOptimizer: IOOptimizer;

    beforeEach(() => {
      ioOptimizer = createIOOptimizer({
        bufferSize: 1024,
        flushInterval: 50,
        batchSize: 5,
        enableCompression: false,
      });
    });

    afterEach(() => {
      ioOptimizer.destroy();
    });

    test('should parse JSON with monitoring', () => {
      const json = '{"test": "value"}';
      const parsed = ioOptimizer.parseJSON(json);
      expect(parsed).toEqual({ test: 'value' });

      const stats = ioOptimizer.getPerformanceStats();
      expect(stats.messagesPerSecond).toBeGreaterThanOrEqual(0);
    });

    test('should stringify JSON with monitoring', () => {
      const obj = { test: 'value' };
      const stringified = ioOptimizer.stringifyJSON(obj);
      expect(stringified).toBe('{"test":"value"}');

      const stats = ioOptimizer.getPerformanceStats();
      expect(stats.messagesPerSecond).toBeGreaterThanOrEqual(0);
    });

    test('should create message batcher', () => {
      const messages: string[][] = [];
      const batcher = ioOptimizer.createMessageBatcher((msgs) => {
        messages.push(msgs);
      });

      batcher.addMessage('message1');
      batcher.addMessage('message2');
      batcher.flush();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(['message1', 'message2']);

      batcher.destroy();
    });
  });

  describe('PerformanceMonitor', () => {
    beforeEach(() => {
      globalPerformanceMonitor.reset();
    });

    test('should track benchmarks', () => {
      const measureInstance = measure('test-operation');
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Busy wait for 10ms
      }
      
      const duration = measureInstance.end();
      expect(duration).toBeGreaterThan(0);

      const stats = globalPerformanceMonitor.getBenchmarkStats();
      expect(stats.completedBenchmarks).toBe(1);
    });

    test('should record requests', () => {
      globalPerformanceMonitor.recordRequest(100, false);
      globalPerformanceMonitor.recordRequest(200, true);

      const metrics = globalPerformanceMonitor.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.totalErrors).toBe(1);
    });

    test('should generate performance report', () => {
      globalPerformanceMonitor.recordRequest(100, false);
      const report = globalPerformanceMonitor.generateReport();
      
      expect(report).toContain('Performance Report');
      expect(report).toContain('Total Requests');
      expect(report).toContain('Memory Usage');
    });
  });

  describe('ErrorHandlerManager', () => {
    let errorHandler: ErrorHandlerManager;

    beforeEach(() => {
      errorHandler = new ErrorHandlerManager();
    });

    afterEach(() => {
      errorHandler.reset();
    });

    test('should execute functions with protection', async () => {
      const testFunction = async () => {
        return 'success';
      };

      const result = await errorHandler.executeWithFullProtection(
        testFunction,
        'test-context'
      );

      expect(result).toBe('success');
    });

    test('should handle and retry failures', async () => {
      let attempts = 0;
      const testFunction = async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Network timeout');
          (error as any).code = 'ETIMEDOUT';
          throw error;
        }
        return 'success';
      };

      const result = await errorHandler.executeWithFullProtection(
        testFunction,
        'test-context'
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('should provide error statistics', async () => {
      try {
        await errorHandler.executeWithFullProtection(
          async () => {
            throw new Error('Test error');
          },
          'test-context'
        );
      } catch {
        // Expected to fail
      }

      const stats = errorHandler.getStats();
      expect(stats.errorBoundary.totalErrors).toBeGreaterThan(0);
    });
  });
});

describe('Performance Integration', () => {
  test('should work together in a realistic scenario', async () => {
    // Simulate a typical MCP server operation with all optimizations
    const memoryManager = createMemoryManager();
    const ioOptimizer = createIOOptimizer();
    
    try {
      // Start memory monitoring
      memoryManager.startMonitoring();
      
      // Simulate processing multiple requests
      for (let i = 0; i < 10; i++) {
        const measureInstance = measure(`request-${i}`);
        
        // Simulate JSON parsing
        const requestData = ioOptimizer.parseJSON(`{"id": ${i}, "task": "test task ${i}"}`) as { id: number; task: string };
        
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Simulate JSON response
        const response = ioOptimizer.stringifyJSON({
          id: requestData.id,
          result: 'Task recorded',
        });
        
        measureInstance.end();
        globalPerformanceMonitor.recordRequest(50, false);
      }
      
      // Check that everything is working
      const performanceStats = globalPerformanceMonitor.getPerformanceSummary();
      expect(performanceStats.requestsPerSecond).toBeGreaterThan(0);
      
      const ioStats = ioOptimizer.getPerformanceStats();
      expect(ioStats.messagesPerSecond).toBeGreaterThan(0);
      
    } finally {
      memoryManager.destroy();
      ioOptimizer.destroy();
    }
  });
});