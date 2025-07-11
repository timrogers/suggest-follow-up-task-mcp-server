/**
 * Enhanced error handling utilities for the MCP server
 * Provides comprehensive error boundaries, graceful degradation, and retry mechanisms
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
  retryCondition?: (error: any) => boolean;
}

export interface ErrorBoundaryOptions {
  fallbackValue?: any;
  onError?: (error: Error, context: string) => void;
  enableLogging: boolean;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  component: string;
  operation: string;
  severity: ErrorSeverity;
  metadata?: Record<string, any>;
  timestamp: number;
}

export class EnhancedError extends Error {
  constructor(
    message: string,
    public context: ErrorContext,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'EnhancedError';
    
    if (originalError) {
      this.stack = originalError.stack;
    }
  }

  toJSON(): any {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      stack: this.stack,
      originalError: this.originalError?.message,
    };
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export class RetryManager {
  constructor(private options: RetryOptions) {}

  /**
   * Execute function with retry logic
   */
  async execute<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    let lastError: any;
    let delay = this.options.baseDelay;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if we should retry this error
        if (this.options.retryCondition && !this.options.retryCondition(error)) {
          throw error;
        }

        // Don't wait after the last attempt
        if (attempt === this.options.maxAttempts) {
          break;
        }

        // Wait before next attempt
        await this.sleep(delay);

        // Calculate next delay with exponential backoff
        delay = Math.min(delay * this.options.backoffFactor, this.options.maxDelay);
      }
    }

    throw new EnhancedError(
      `Operation failed after ${this.options.maxAttempts} attempts`,
      {
        component: 'RetryManager',
        operation: context || 'unknown',
        severity: ErrorSeverity.HIGH,
        metadata: { attempts: this.options.maxAttempts },
        timestamp: Date.now(),
      },
      lastError
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold: number,
    private recoveryTimeout: number
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new EnhancedError(
          'Circuit breaker is open',
          {
            component: 'CircuitBreaker',
            operation: 'execute',
            severity: ErrorSeverity.MEDIUM,
            metadata: { state: this.state, failures: this.failures },
            timestamp: Date.now(),
          }
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getStatus(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
  }
}

/**
 * Error boundary for catching and handling errors gracefully
 */
export class ErrorBoundary {
  private errorCounts = new Map<string, number>();
  private errorHistory: EnhancedError[] = [];
  private readonly maxHistorySize = 100;

  constructor(private options: ErrorBoundaryOptions) {}

  /**
   * Wrap a function with error boundary protection
   */
  wrap<T extends any[], R>(
    fn: (...args: T) => R,
    context: string
  ): (...args: T) => R {
    return (...args: T): R => {
      try {
        const result = fn(...args);
        
        // Handle promises
        if (result && typeof result === 'object' && 'then' in result && typeof (result as any).then === 'function') {
          return ((result as any).catch((error: any) =>
            this.handleError(error, context)
          )) as R;
        }
        
        return result;
      } catch (error) {
        return this.handleError(error, context);
      }
    };
  }

  /**
   * Wrap an async function with error boundary protection
   */
  wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context: string
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        return this.handleError(error, context);
      }
    };
  }

  /**
   * Handle errors with graceful degradation
   */
  private handleError(error: any, context: string): any {
    // Create enhanced error
    const enhancedError = this.createEnhancedError(error, context);
    
    // Track error count
    const errorKey = `${context}:${enhancedError.message}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    
    // Add to history
    this.errorHistory.push(enhancedError);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Call error callback if provided
    if (this.options.onError) {
      try {
        this.options.onError(enhancedError, context);
      } catch (callbackError) {
        if (this.options.enableLogging) {
          console.error('Error in error callback:', callbackError);
        }
      }
    }

    // Log error if enabled
    if (this.options.enableLogging) {
      console.error(`Error in ${context}:`, enhancedError);
    }

    // Return fallback value or re-throw
    if (this.options.fallbackValue !== undefined) {
      return this.options.fallbackValue;
    }

    throw enhancedError;
  }

  private createEnhancedError(error: any, context: string): EnhancedError {
    if (error instanceof EnhancedError) {
      return error;
    }

    const severity = this.determineSeverity(error, context);

    return new EnhancedError(
      error.message || String(error),
      {
        component: 'ErrorBoundary',
        operation: context,
        severity,
        metadata: { 
          errorType: error.constructor.name,
          errorCount: this.errorCounts.get(`${context}:${error.message}`) || 1,
        },
        timestamp: Date.now(),
      },
      error instanceof Error ? error : undefined
    );
  }

  private determineSeverity(error: any, context: string): ErrorSeverity {
    // Determine severity based on error type and context
    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      return ErrorSeverity.HIGH;
    }

    if (error.message.includes('timeout') || error.message.includes('network')) {
      return ErrorSeverity.MEDIUM;
    }

    if (context.includes('validation') || context.includes('parsing')) {
      return ErrorSeverity.LOW;
    }

    return ErrorSeverity.MEDIUM;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    uniqueErrors: number;
    errorsByContext: Record<string, number>;
    recentErrors: EnhancedError[];
  } {
    const errorsByContext: Record<string, number> = {};
    
    for (const [key, count] of this.errorCounts.entries()) {
      const context = key.split(':')[0];
      errorsByContext[context] = (errorsByContext[context] || 0) + count;
    }

    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      uniqueErrors: this.errorCounts.size,
      errorsByContext,
      recentErrors: this.errorHistory.slice(-10),
    };
  }

  /**
   * Clear error history and counts
   */
  reset(): void {
    this.errorCounts.clear();
    this.errorHistory = [];
  }
}

/**
 * Main error handler manager
 */
export class ErrorHandlerManager {
  private retryManager: RetryManager;
  private circuitBreaker: CircuitBreaker;
  private errorBoundary: ErrorBoundary;

  constructor() {
    this.retryManager = new RetryManager({
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      retryCondition: (error) => {
        // Retry on network errors, timeouts, but not on validation errors
        return (
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.message.includes('timeout') ||
          error.message.includes('network')
        );
      },
    });

    this.circuitBreaker = new CircuitBreaker(5, 30000); // 5 failures, 30s recovery

    this.errorBoundary = new ErrorBoundary({
      enableLogging: true,
      onError: (_error, _context) => {
        // Could emit events here for monitoring
      },
    });
  }

  /**
   * Execute function with full error handling (retry + circuit breaker + boundary)
   */
  async executeWithFullProtection<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T> {
    return this.errorBoundary.wrapAsync(async () => {
      return this.circuitBreaker.execute(async () => {
        return this.retryManager.execute(fn, context);
      });
    }, context)();
  }

  /**
   * Get comprehensive error statistics
   */
  getStats(): {
    circuitBreaker: ReturnType<CircuitBreaker['getStatus']>;
    errorBoundary: ReturnType<ErrorBoundary['getErrorStats']>;
  } {
    return {
      circuitBreaker: this.circuitBreaker.getStatus(),
      errorBoundary: this.errorBoundary.getErrorStats(),
    };
  }

  /**
   * Reset all error handling state
   */
  reset(): void {
    this.circuitBreaker.reset();
    this.errorBoundary.reset();
  }
}

// Default error handler instance
export const defaultErrorHandler = new ErrorHandlerManager();