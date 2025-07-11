# suggest-follow-up-task-mcp-server

A basic MCP (Model Context Protocol) server for suggesting follow-up tasks, built in TypeScript.

## Features

- **propose_task** tool: Records a task and returns confirmation
- Minimal, focused implementation
- TypeScript-based with full type safety
- Stdio transport for MCP communication

## Usage

You can run this MCP server directly from GitHub without installing it to npm:

```bash
npx github:timrogers/suggest-follow-up-task-mcp-server
```

Or if you want to run it locally after cloning:

```bash
# Clone the repository
git clone https://github.com/timrogers/suggest-follow-up-task-mcp-server.git
cd suggest-follow-up-task-mcp-server

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Start the server
npm start

# Or run directly with npx
npx suggest-follow-up-task-mcp-server
```

## Available Tools

### propose_task

TODO: Add description for proposing follow-up tasks

**Arguments:** None

**Returns:** "Task recorded" message

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev
```

## MCP Configuration

To use this server with an MCP client, configure it to run:

```bash
npx github:timrogers/suggest-follow-up-task-mcp-server
```

The server uses stdio transport and will communicate via stdin/stdout with the MCP client.