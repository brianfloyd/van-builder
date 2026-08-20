// Node-side read/write for the live project file and named variant
// snapshots. Uses src/projectOps.ts's normalizeProject for the exact same
// defaults-merge the browser app uses on load/import — not reimplemented.

import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_FILE, VARIANTS_DIR } from '../bridge-paths.js';
import { normalizeProject, type ProjectDefaults } from '../src/projectOps.js';
import { DEFAULT_DEFS, DEFAULT_SHELL, buildDefaultOverlapMatrix } from '../src/defaultData.js';
import type { ProjectState } from '../src/types.js';

export const DEFAULTS: ProjectDefaults = {
  shell: DEFAULT_SHELL,
  defs: DEFAULT_DEFS,
  buildOverlapMatrix: buildDefaultOverlapMatrix,
};

export function readProject(): ProjectState {
  if (!fs.existsSync(PROJECT_FILE)) return normalizeProject(null, DEFAULTS);
  try {
    const raw = fs.readFileSync(PROJECT_FILE, 'utf-8');
    return normalizeProject(JSON.parse(raw), DEFAULTS);
  } catch {
    return normalizeProject(null, DEFAULTS);
  }
}

export function writeProject(project: ProjectState): void {
  fs.writeFileSync(PROJECT_FILE, JSON.stringify(project, null, 2), 'utf-8');
}

function ensureVariantsDir() {
  fs.mkdirSync(VARIANTS_DIR, { recursive: true });
}

function variantPath(name: string): string {
  const safe = name.replace(/[^a-z0-9-_ ]/gi, '_').trim();
  if (!safe) throw new Error('Variant name must contain at least one letter, digit, space, hyphen, or underscore.');
  return path.join(VARIANTS_DIR, `${safe}.json`);
}

export function saveVariant(name: string, project: ProjectState): string {
  ensureVariantsDir();
  const file = variantPath(name);
  const payload = { ...project, savedAt: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8');
  return path.basename(file, '.json');
}

export function loadVariant(name: string): ProjectState {
  ensureVariantsDir();
  const file = variantPath(name);
  if (!fs.existsSync(file)) {
    const available = listVariants().map((v) => v.name);
    throw new Error(
      `No saved variant named "${name}".` + (available.length ? ` Available: ${available.join(', ')}` : ' No variants saved yet.')
    );
  }
  const raw = fs.readFileSync(file, 'utf-8');
  return normalizeProject(JSON.parse(raw), DEFAULTS);
}

export interface VariantInfo {
  name: string;
  savedAt?: string;
}

export function listVariants(): VariantInfo[] {
  ensureVariantsDir();
  return fs
    .readdirSync(VARIANTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const name = path.basename(f, '.json');
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(VARIANTS_DIR, f), 'utf-8'));
        return { name, savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : undefined };
      } catch {
        return { name };
      }
    });
}
