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

Suggest a follow-up task to complete in the future in this codebase. As you work, if you identify follow-up tasks that are likely to be valuable or useful, call this tool to propose them. When you finish work, consider again, and call this tool to propose any valuable follow-up tasks you haven't yet proposed.

**Arguments:** 
- `task` (string, required): The follow-up task to propose, for example `Add unit tests for transformWidget function in src/widgets.ts` or `Handle empty string in title validation in app/models/ticket.rb`

**Returns:** "Task recorded" message

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run all checks (lint, format, build, test)
npm run check

# Fix linting and formatting issues
npm run fix
```

## Testing

The project includes comprehensive integration tests that verify:

- Server startup and shutdown
- MCP protocol communication via stdio
- Tool listing and execution
- Error handling
- JSON-RPC message handling

Run tests with:

```bash
npm test
```

## CI/CD and Code Quality

This project uses GitHub Actions for continuous integration with the following features:

- **Multi-version Node.js testing**: Tests run on Node.js 18.x and 20.x
- **Comprehensive checks**: Linting (ESLint), formatting (Prettier), building (TypeScript), and testing (Jest)
- **Reviewdog integration**: Automated PR review comments for linting and TypeScript compilation issues
  - ESLint issues are posted as inline PR comments
  - TypeScript compilation errors are highlighted directly in the PR
  - Only runs on pull requests for focused feedback

The CI workflow ensures code quality while providing developers with immediate, actionable feedback during the review process.

## MCP Configuration

To use this server with an MCP client, configure it to run:

```bash
npx github:timrogers/suggest-follow-up-task-mcp-server
```

The server uses stdio transport and will communicate via stdin/stdout with the MCP client.