#!/usr/bin/env tsx

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  createMemoryManager,
  defaultCacheManager,
  createIOOptimizer,
  defaultErrorHandler,
  globalPerformanceMonitor,
  measure,
} from './performance/index';

// Initialize performance components
const memoryManager = createMemoryManager();
const ioOptimizer = createIOOptimizer();

// Pre-compile Zod schema for better performance
const taskSchema = z.object({
  task: z
    .string()
    .describe(
      'The follow-up task to propose as an imperative statement (e.g., "Add unit tests for transformWidget function in src/widgets.ts" or "Handle empty string in title validation in app/models/ticket.rb"). Avoid vague phrases like "Consider..." or "Think about..."'
    ),
});

/**
 * Main function to start the MCP server
 */
async function main() {
  const serverStartMeasure = measure('server-startup');
  
  try {
    // Create the MCP server with basic information
    const server = new McpServer(
      {
        name: 'suggest-follow-up-task-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register the propose_task tool with performance optimizations
    server.tool(
      'propose_task',
      "Suggest a follow-up task to complete in the future in this codebase. As you work, if you identify follow-up tasks that are likely to be valuable or useful, call this tool to propose them. When you finish work, consider again, and call this tool to propose any valuable follow-up tasks you haven't yet proposed.",
      {
        task: z
          .string()
          .describe(
            'The follow-up task to propose as an imperative statement (e.g., "Add unit tests for transformWidget function in src/widgets.ts" or "Handle empty string in title validation in app/models/ticket.rb"). Avoid vague phrases like "Consider..." or "Think about..."'
          ),
      },
      (args: { task: string }) => {
        const toolMeasure = measure('propose-task-execution');
        
        try {
          // Check cache first
          const cachedResponse = defaultCacheManager.getCachedToolResponse('propose_task', args);
          
          if (cachedResponse) {
            globalPerformanceMonitor.recordRequest(toolMeasure.end(), false);
            return cachedResponse;
          }

          // Validate input using pre-compiled schema
          const validationResult = taskSchema.safeParse(args);
          if (!validationResult.success) {
            const errorMessage = `Invalid arguments for tool propose_task: ${validationResult.error.message}`;
            globalPerformanceMonitor.recordRequest(toolMeasure.end(), true);
            throw new Error(errorMessage);
          }

          const response = {
            content: [
              {
                type: 'text',
                text: 'Task recorded',
              },
            ],
          };

          // Cache the response
          defaultCacheManager.cacheToolResponse('propose_task', args, response);
          
          globalPerformanceMonitor.recordRequest(toolMeasure.end(), false);
          return response;
        } catch (error) {
          globalPerformanceMonitor.recordRequest(toolMeasure.end(), true);
          throw error;
        }
      }
    );

    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Setup memory monitoring and cleanup
    memoryManager.startMonitoring();
    
    // Register cleanup callbacks
    memoryManager.registerCleanupCallback(() => {
      defaultCacheManager.clearAll();
      globalPerformanceMonitor.reset();
    });

    // Memory event handlers (log to stderr to avoid stdio interference)
    memoryManager.on('memory-warning', (stats) => {
      console.warn(`Memory warning: ${stats.heapUsed}MB used`);
    });

    memoryManager.on('memory-critical', (stats) => {
      console.error(`Memory critical: ${stats.heapUsed}MB used - executing cleanup`);
      defaultCacheManager.clearAll();
    });

    memoryManager.on('memory-leak-detected', (stats) => {
      console.error(`Potential memory leak detected: ${stats.heapUsed}MB used`);
    });

    // Performance monitoring
    globalPerformanceMonitor.on('metrics-updated', () => {
      // Update cache statistics
      const cacheStats = defaultCacheManager.getOverallStats();
      const totalEntries = cacheStats.toolResponses.size + cacheStats.schemaValidation.size + cacheStats.generalData.size;
      const avgHitRate = (cacheStats.toolResponses.hitRate + cacheStats.schemaValidation.hitRate + cacheStats.generalData.hitRate) / 3;
      
      globalPerformanceMonitor.recordCacheStats(avgHitRate, totalEntries);
    });

    serverStartMeasure.end();
    // Note: Avoiding console.log here to prevent interference with JSON-RPC stdio communication

    // Handle process shutdown gracefully
    const shutdownHandler = async (signal: string) => {
      // Log to stderr to avoid stdio interference
      process.stderr.write(`Received ${signal}, shutting down gracefully...\n`);
      
      try {
        // Generate performance report before shutdown
        const report = globalPerformanceMonitor.generateReport();
        process.stderr.write('\nPerformance Report:\n' + report + '\n');

        // Cleanup resources
        memoryManager.destroy();
        defaultCacheManager.destroy();
        ioOptimizer.destroy();
        globalPerformanceMonitor.destroy();

        await server.close();
        process.exit(0);
      } catch (error) {
        process.stderr.write(`Error during shutdown: ${error}\n`);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));

  } catch (error) {
    serverStartMeasure.end();
    process.stderr.write(`Failed to start server: ${error}\n`);
    throw error;
  }
}

// Handle errors at the top level with enhanced error handling
defaultErrorHandler.executeWithFullProtection(main, 'main-server-startup')
  .catch(error => {
    process.stderr.write(`Server error: ${error}\n`);
    process.exit(1);
  });
