#!/usr/bin/env node
// Van Builder MCP server — HTTP transport (for remote agents via Tailscale Funnel).
//
// Same tools as the stdio transport, but exposed over HTTP on localhost.
// Bind to 127.0.0.1 only by default — use Tailscale Funnel to expose securely.
//
// Usage: npm run mcp:http
// Environment variables:
//   VAN_BUILDER_MCP_PORT  — HTTP port (default: 8767)
//   VAN_BUILDER_MCP_TOKEN — Optional bearer token for authentication
//
// Funnel example:
//   tailscale funnel --bg --https=8444 localhost:8767
//
// Then configure Grok Bot / Parts Bot with:
//   URL: https://your-machine.tail12345.ts.net:8444/mcp
//
// See mcp-server/server.ts for tool registration (shared between transports).

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createVanBuilderServer } from './server.js';

const PORT = parseInt(process.env.VAN_BUILDER_MCP_PORT || '8767', 10);
const TOKEN = process.env.VAN_BUILDER_MCP_TOKEN || null;
const HOST = '127.0.0.1';

const server = createVanBuilderServer();

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (TOKEN) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${TOKEN}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
    try {
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error('MCP request error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
    return;
  }

  if (url.pathname === '/health' || url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'van-builder',
      transport: 'streamable-http',
      mcpPath: '/mcp',
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', hint: 'MCP endpoint is at /mcp' }));
});

async function main() {
  await server.connect(transport);

  httpServer.listen(PORT, HOST, () => {
    console.log(`van-builder MCP server (HTTP) listening on http://${HOST}:${PORT}`);
    console.log(`  MCP endpoint: http://${HOST}:${PORT}/mcp`);
    console.log(`  Health check: http://${HOST}:${PORT}/health`);
    if (TOKEN) {
      console.log('  Authentication: Bearer token required');
    } else {
      console.log('  Authentication: None (loopback only — use Tailscale Funnel for secure remote access)');
    }
    console.log('');
    console.log('Tailscale Funnel example:');
    console.log(`  tailscale funnel --bg --https=8444 localhost:${PORT}`);
    console.log('');
    console.log('Then add MCP server in Grok Bot / Parts Bot:');
    console.log('  URL: https://your-machine.tail12345.ts.net:8444/mcp');
  });
}

main().catch((err) => {
  console.error('van-builder MCP server (HTTP) failed to start:', err);
  process.exit(1);
});
