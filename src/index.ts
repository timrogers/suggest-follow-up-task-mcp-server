#!/usr/bin/env tsx

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

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
    "Suggest a follow-up task to complete in the future in this codebase. As you work, if you identify follow-up tasks that are likely to be valuable or useful, call this tool to propose them. When you finish work, consider again, and call this tool to propose any valuable follow-up tasks you haven't yet proposed.",
    {
      task: z
        .string()
        .describe(
          'The follow-up task to propose, for example `Add unit tests for transformWidget function in src/widgets.ts` or `Handle empty string in title validation in app/models/ticket.rb`'
        ),
    },
    (_args: { task: string }) => {
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
main().catch(error => {
  console.error('Server error:', error);
  process.exit(1);
});
