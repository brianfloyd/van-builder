// Node-only path constants shared by the Vite dev-server file-bridge plugin
// (vite-project-bridge.ts) and the MCP server (mcp-server/*). Kept at the
// repo root, outside src/, because src/ is bundled for the browser and must
// never import Node's `fs`/`path`. Protocol-level constants the browser also
// needs (HTTP path, HMR event name) live in bridge-protocol.ts instead.

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The live project file both the running dev app and the MCP server read
 * from / write to. Gitignored — this is working state, not source. */
export const PROJECT_FILE = path.join(here, 'van-builder-project.json');

/** Named layout snapshots (save_variant/load_variant/list_variants), one
 * JSON file per variant. Gitignored. */
export const VARIANTS_DIR = path.join(here, 'van-builder-variants');
