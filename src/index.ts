#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

/**
 * Main function to start the MCP server
 */
async function main() {
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

  // Register the propose_task tool
  server.tool(
    'propose_task',
    'TODO: Add description for proposing follow-up tasks', // Placeholder description as requested
    () => {
      return {
        content: [
          {
            type: 'text',
            text: 'Task recorded',
          },
        ],
      };
    }
  );

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle process shutdown gracefully
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}

// Handle errors at the top level
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});