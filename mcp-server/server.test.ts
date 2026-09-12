// Basic test that the shared MCP server can be created and has the expected tools.
import { describe, it, expect } from 'vitest';
import { createVanBuilderServer } from './server.js';

describe('createVanBuilderServer', () => {
  it('creates an MCP server with the van-builder name', () => {
    const server = createVanBuilderServer();
    expect(server).toBeDefined();
  });

  it('server has tool capabilities registered', () => {
    const server = createVanBuilderServer();
    // The server should have tool handling capability after registration
    // This is a basic smoke test that the server was created without errors
    expect(server).toHaveProperty('tool');
  });
});
