// Isomorphic constants for the dev-only file<->browser bridge — safe to
// import from BOTH the browser bundle (src/devSync.ts) and Node-side code
// (vite-project-bridge.ts, mcp-server/*). No fs/path here on purpose: this
// file must never pull `node:*` imports into the browser build.

/** Vite dev-middleware endpoint the browser polls/POSTs to sync the project
 * file. Only exists in `npm run dev` — never call this outside DEV. */
export const BRIDGE_HTTP_PATH = '/api/project';

/** Custom Vite HMR event name used to push file changes (made by the MCP
 * server, or anything else external) straight to the running browser tab. */
export const BRIDGE_HMR_EVENT = 'van-builder:project-changed';
