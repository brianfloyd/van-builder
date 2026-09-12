#!/usr/bin/env node
// Van Builder MCP server — stdio transport (for Claude Desktop/Code).
//
// Lets an external Claude instance place/move/remove components and
// speculate on layouts programmatically, without touching the UI. It reads
// and writes the SAME project file the running dev app syncs against (see
// vite-project-bridge.ts) using the exact JSON schema as the app's own
// Export/Import JSON feature (ProjectState, from src/types.ts).
//
// Usage: npm run mcp
//
// This is the stdio transport — for HTTP transport (remote agents via
// Tailscale Funnel), use: npm run mcp:http
//
// See mcp-server/server.ts for tool registration (shared between transports).

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createVanBuilderServer } from './server.js';

async function main() {
  const server = createVanBuilderServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('van-builder MCP server (stdio) failed to start:', err);
  process.exit(1);
});
