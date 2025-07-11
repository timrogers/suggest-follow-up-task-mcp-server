# suggest-follow-up-task-mcp-server

A basic MCP (Model Context Protocol) server to allow AI agents to propose follow-up tasks.

The follow-up tasks proposed don't get stored anywhere - but adding a tool like this is a way to elicit suggestions from the model, and record them to the agent logs for future analysis.

## Usage with [GitHub Copilot coding agent](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/about-copilot-coding-agent)

1. Update your repository's MCP configuration, adding the server

```json
{ 
  "mcpServers": {
    "suggest-follow-up-task": {
      "type": "local",
      "tools": ["*"],
      "command": "npx",
      "args": ["-y", "github:timrogers/suggest-follow-up-task-mcp-server"]
    }
  }
}
```

2. Add a `.github/copilot-instructions.md` file to prompt the model to use the tool *(optional)*

```md
As you work, watch out for potential follow-up tasks in this repository that are likely to be valuable or useful.

When you spot such a task, call the suggest-follow-up-task-propose_task with a short description.

When you finish work, think deeply about this again, and propose any further follow-up tasks that you've missed.
```

3. Ask Copilot to work on a task. In the logs, you will see follow-up tasks proposed by Copilot.

<img width="885" height="284" alt="Example follow up task in the logs" src="https://github.com/user-attachments/assets/d0cb0bdd-478c-46cb-a72f-25c9036cd85a" />

## Features

- **propose_task** tool: Records a task and returns confirmation
- Minimal, focused implementation
- TypeScript-based with full type safety
- Stdio transport for MCP communication

## Available tools

### propose_task

Suggest a follow-up task to complete in the future in this codebase. As you work, if you identify follow-up tasks that are likely to be valuable or useful, call this tool to propose them. When you finish work, consider again, and call this tool to propose any valuable follow-up tasks you haven't yet proposed.

**Arguments:** 
- `task` (string, required): The follow-up task to propose as an imperative statement (e.g., "Add unit tests for transformWidget function in src/widgets.ts" or "Handle empty string in title validation in app/models/ticket.rb"). Avoid vague phrases like "Consider..." or "Think about..."

**Returns:** "Task recorded" message

## Local development

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
