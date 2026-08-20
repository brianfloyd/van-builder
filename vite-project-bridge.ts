// Dev-only Vite plugin: lets the running app and the MCP server share one
// live project file.
//   - GET  /api/project  → current file contents (or null if none yet)
//   - POST /api/project  → browser pushes its current state (so manual UI
//                          edits stay reflected in the bridge file too)
//   - fs.watch on the file → any external write (i.e. the MCP server) is
//     pushed to the browser over Vite's own HMR websocket, so the running
//     app hot-reloads without a page refresh. No separate WebSocket server.
//
// Only wired up in `npm run dev` (see vite.config.ts) — never runs in a
// production build/preview.

import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { PROJECT_FILE } from './bridge-paths';
import { BRIDGE_HTTP_PATH, BRIDGE_HMR_EVENT } from './bridge-protocol';

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Cheap non-cryptographic hash, just for "did this change" comparisons.
function hashOf(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h.toString(36);
}

export function projectBridgePlugin(): Plugin {
  let lastWrittenHash = '';

  return {
    name: 'van-builder-project-bridge',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(BRIDGE_HTTP_PATH, (req, res) => {
        if (req.method === 'GET') {
          const data = fs.existsSync(PROJECT_FILE) ? fs.readFileSync(PROJECT_FILE, 'utf-8') : 'null';
          res.setHeader('Content-Type', 'application/json');
          res.end(data);
          return;
        }
        if (req.method === 'POST') {
          readBody(req)
            .then((body) => {
              const str = JSON.stringify(JSON.parse(body), null, 2); // validate + pretty-print
              lastWrittenHash = hashOf(str);
              fs.writeFileSync(PROJECT_FILE, str, 'utf-8');
              res.statusCode = 204;
              res.end();
            })
            .catch((err) => {
              res.statusCode = 400;
              res.end(String(err));
            });
          return;
        }
        res.statusCode = 405;
        res.end();
      });

      // Watch the containing directory (not the file directly — the file
      // may not exist yet the first time the MCP server or the browser
      // creates it) and debounce, since editors/writers can fire several
      // change events per save.
      const dir = path.dirname(PROJECT_FILE);
      const target = path.basename(PROJECT_FILE);
      let debounce: ReturnType<typeof setTimeout> | null = null;

      fs.watch(dir, (_event, filename) => {
        if (filename !== target) return;
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          if (!fs.existsSync(PROJECT_FILE)) return;
          const raw = fs.readFileSync(PROJECT_FILE, 'utf-8');
          if (hashOf(raw) === lastWrittenHash) return; // our own POST-triggered write echoing back — skip
          try {
            const data = JSON.parse(raw);
            server.ws.send({ type: 'custom', event: BRIDGE_HMR_EVENT, data });
          } catch {
            // mid-write partial file — ignore, next change event will catch up
          }
        }, 100);
      });
    },
  };
}
