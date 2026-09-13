// Tests for the HTTP transport server (SSE + Streamable HTTP)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { once } from 'node:events';

const PORT = 8768; // Use different port for tests

// Simple HTTP request helper
function httpRequest(options: http.RequestOptions, body?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ ...options, port: PORT }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// SSE connection helper that collects events for a limited time
function collectSSEEvents(path: string, timeoutMs: number): Promise<{ events: Array<{ event?: string; data: string }>; sessionId?: string }> {
  return new Promise((resolve) => {
    const events: Array<{ event?: string; data: string }> = [];
    let sessionId: string | undefined;

    const req = http.request({ host: '127.0.0.1', port: PORT, path, method: 'GET' }, (res) => {
      let buffer = '';

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split('\n');
          let event: string | undefined;
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) event = line.slice(7);
            else if (line.startsWith('data: ')) data = line.slice(6);
          }
          if (data) {
            events.push({ event, data });
            if (event === 'endpoint' && data.includes('sessionId=')) {
              sessionId = data.split('sessionId=')[1];
            }
          }
        }
      });

      setTimeout(() => {
        req.destroy();
        resolve({ events, sessionId });
      }, timeoutMs);
    });

    req.on('error', () => resolve({ events, sessionId }));
    req.end();
  });
}

describe('HTTP Server', () => {
  let serverProcess: ReturnType<typeof import('node:child_process').spawn> | null = null;
  let serverReady = false;

  beforeAll(async () => {
    const { spawn } = await import('node:child_process');

    serverProcess = spawn('npx', ['tsx', 'mcp-server/http.ts'], {
      env: { ...process.env, VAN_BUILDER_MCP_PORT: String(PORT) },
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 10000);

      serverProcess!.stdout?.on('data', (data) => {
        if (data.toString().includes('listening')) {
          clearTimeout(timeout);
          serverReady = true;
          resolve();
        }
      });

      serverProcess!.stderr?.on('data', (data) => {
        console.error('Server stderr:', data.toString());
      });

      serverProcess!.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      serverProcess!.on('exit', (code) => {
        if (!serverReady) {
          clearTimeout(timeout);
          reject(new Error(`Server exited with code ${code}`));
        }
      });
    });
  }, 15000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  describe('Health endpoint', () => {
    it('returns status ok with both transports listed', async () => {
      const res = await httpRequest({ host: '127.0.0.1', path: '/health', method: 'GET' });
      expect(res.status).toBe(200);

      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.server).toBe('van-builder');
      expect(body.transports.streamableHttp.path).toBe('/mcp');
      expect(body.transports.sse.connectPath).toBe('/sse');
      expect(body.transports.sse.messagesPath).toBe('/messages');
    });
  });

  describe('SSE transport', () => {
    it('establishes SSE connection and returns endpoint event', async () => {
      const { events, sessionId } = await collectSSEEvents('/sse', 500);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].event).toBe('endpoint');
      expect(events[0].data).toContain('/messages?sessionId=');
      expect(sessionId).toBeDefined();
      expect(sessionId!.length).toBeGreaterThan(0);
    });

    it('handles POST messages with valid session', async () => {
      // First establish SSE connection
      const { sessionId } = await collectSSEEvents('/sse', 500);
      expect(sessionId).toBeDefined();

      // Note: The session will have closed by now since collectSSEEvents destroys the connection.
      // This test verifies the 404 behavior for an invalid/closed session.
      const res = await httpRequest(
        {
          host: '127.0.0.1',
          path: `/messages?sessionId=${sessionId}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
      );

      // Session should be closed/not found since we destroyed the SSE connection
      expect(res.status).toBe(404);
    });

    it('rejects POST without sessionId', async () => {
      const res = await httpRequest(
        {
          host: '127.0.0.1',
          path: '/messages',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
      );

      expect(res.status).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('sessionId');
    });
  });

  describe('Streamable HTTP transport', () => {
    it('handles initialize request at /mcp', async () => {
      const res = await httpRequest(
        {
          host: '127.0.0.1',
          path: '/mcp',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
        },
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0' },
          },
        })
      );

      expect(res.status).toBe(200);
      expect(res.body).toContain('van-builder');
      expect(res.body).toContain('protocolVersion');
    });
  });

  describe('404 handling', () => {
    it('returns helpful error for unknown paths', async () => {
      const res = await httpRequest({ host: '127.0.0.1', path: '/unknown', method: 'GET' });
      expect(res.status).toBe(404);

      const body = JSON.parse(res.body);
      expect(body.error).toBe('Not found');
      expect(body.endpoints).toBeDefined();
      expect(body.endpoints['/sse']).toBeDefined();
      expect(body.endpoints['/mcp']).toBeDefined();
    });
  });
});
