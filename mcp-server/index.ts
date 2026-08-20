#!/usr/bin/env node
// Van Builder MCP server — Phase 1 (file-bridge).
//
// Lets an external Claude instance place/move/remove components and
// speculate on layouts programmatically, without touching the UI. It reads
// and writes the SAME project file the running dev app syncs against (see
// vite-project-bridge.ts) using the exact JSON schema as the app's own
// Export/Import JSON feature (ProjectState, from src/types.ts) — and every
// placement/collision/resolve operation below calls straight into
// src/projectOps.ts and src/geometry.ts, the same functions the browser
// store uses. Nothing here is a separate reimplementation of that logic.
//
// If the dev server (`npm run dev`) is running, changes made through this
// server hot-reload into the browser live (via a Vite HMR custom event);
// if it's not running, the project file still updates and picks up next
// time the app starts.
//
// Phase-2 note: projectOps.ts and geometry.ts are already framework- and
// runtime-agnostic (no browser or Node-specific imports), so a future
// headless live-sync server (WebSocket push instead of this file-watch
// bridge) can import them directly too — see the note at the top of
// src/projectOps.ts.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ComponentDef, PlacedInstance, ProjectState, Vec3 } from '../src/types.js';
import * as ops from '../src/projectOps.js';
import { readProject, writeProject, saveVariant, loadVariant, listVariants } from './projectFile.js';

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function ok(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function describeInstance(project: ProjectState, inst: PlacedInstance) {
  const def = project.defs.find((d) => d.id === inst.defId);
  return {
    id: inst.id,
    defId: inst.defId,
    componentName: def?.name ?? '(unknown component)',
    mountSurface: def?.mountSurface ?? 'floor',
    label: inst.label,
    pos: inst.pos,
    rotationY: inst.rotationY,
    locked: inst.locked ?? false,
  };
}

function violationsFor(project: ProjectState, instanceId?: string) {
  const all = ops.getViolations(project);
  return instanceId ? all.filter((v) => v.instanceIds.includes(instanceId)) : all;
}

// ---------------------------------------------------------------------------
// Server + tools
// ---------------------------------------------------------------------------

const server = new McpServer({ name: 'van-builder', version: '1.0.0' });

const rotationSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);

server.tool(
  'list_catalog',
  'List every component type in the catalog (id, name, category, dimensions in inches, ' +
    'mount surface, and overlap group). Call this first to get real componentId values before ' +
    'placing anything — place_item/place_items need an id from here, not a name.',
  {},
  async (): Promise<CallToolResult> => {
    const project = readProject();
    return ok({
      count: project.defs.length,
      components: project.defs.map((d: ComponentDef) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        mountSurface: d.mountSurface ?? 'floor',
        dims: d.dims,
        overlapGroup: d.overlapGroup,
      })),
    });
  }
);

server.tool(
  'get_layout',
  'Get the current van shell configuration, every placed component instance, and the live list ' +
    'of conflicts (collisions, out-of-bounds, cab-zone obstacles) — the same conflict detection ' +
    'the app itself uses. Coordinate frame: x = across width (0 = left wall), y = up (0 = van ' +
    'floor; negative = below floor on the underbody plane), z = along length (0 = front/cab wall). ' +
    'Units are inches. A placed item\'s x/z is its footprint CENTER (stable under rotation); y is ' +
    'its BASE height on whichever plane it mounts to (floor/roof/underbody).',
  {},
  async (): Promise<CallToolResult> => {
    const project = readProject();
    return ok({
      shell: project.shell,
      instances: project.instances.map((i: PlacedInstance) => describeInstance(project, i)),
      overlapMatrix: project.overlapMatrix,
      violations: ops.getViolations(project),
    });
  }
);

const placeItemShape = {
  componentId: z.string().describe('A def id from list_catalog.'),
  plane: z
    .enum(['floor', 'roof', 'underbody'])
    .optional()
    .describe(
      'Optional sanity check, not a placement choice — each component already has a fixed mount ' +
        'surface (see list_catalog). If given, it must match that component\'s actual surface or the ' +
        'call fails with an error instead of silently placing it on the wrong plane.'
    ),
  x: z.number().describe('Footprint center, inches from the left wall (x=0).'),
  y: z.number().describe('Base height, inches. 0 = that plane\'s floor (van floor for "floor", roof surface for "roof", van floor underside for "underbody", where negative values go further down).'),
  z: z.number().describe('Footprint center, inches from the front/cab wall (z=0).'),
  rotation: rotationSchema.optional().default(0).describe('Yaw in degrees, one of 0/90/180/270.'),
  label: z.string().optional().describe('Optional display label override for this instance.'),
};

function placeOne(
  project: ProjectState,
  args: { componentId: string; plane?: string; x: number; y: number; z: number; rotation?: number; label?: string }
): { project: ProjectState; result: unknown; error?: string } {
  const def = project.defs.find((d) => d.id === args.componentId);
  if (!def) {
    return { project, result: null, error: `No component with id "${args.componentId}". Call list_catalog for valid ids.` };
  }
  const actualSurface = def.mountSurface ?? 'floor';
  if (args.plane && args.plane !== actualSurface) {
    return {
      project,
      result: null,
      error: `"${def.name}" mounts on "${actualSurface}", not "${args.plane}". Omit plane or pass the correct one.`,
    };
  }
  const rotationY = (args.rotation ?? 0) as 0 | 90 | 180 | 270;
  const placed = ops.placeInstanceAt(project, args.componentId, { x: args.x, y: args.y, z: args.z }, rotationY);
  if ('error' in placed) return { project, result: null, error: placed.error };
  let next = placed.project;
  if (args.label) next = ops.updateInstance(next, placed.instance.id, { label: args.label });
  const finalInstance = next.instances.find((i) => i.id === placed.instance.id)!;
  return {
    project: next,
    result: {
      instance: describeInstance(next, finalInstance),
      violations: violationsFor(next, finalInstance.id),
    },
  };
}

server.tool(
  'place_item',
  'Place one instance of a catalog component at an exact position/rotation. Returns the created ' +
    'instance and any conflicts it introduces (it is still placed even if it conflicts — check the ' +
    'returned violations, or call check_conflicts / snap_to_safe).',
  placeItemShape,
  async (args): Promise<CallToolResult> => {
    const project = readProject();
    const { project: next, result, error } = placeOne(project, args);
    if (error) return fail(error);
    writeProject(next);
    return ok(result);
  }
);

server.tool(
  'place_items',
  'Place several components in one call — the batch version of place_item, for laying out or ' +
    'speculating on a whole section at once. Best-effort: each entry is applied independently, so ' +
    'one bad componentId doesn\'t block the rest. Returns per-item results plus the full ' +
    'whole-layout conflict list after all placements.',
  { items: z.array(z.object(placeItemShape)).min(1) },
  async ({ items }): Promise<CallToolResult> => {
    let project = readProject();
    const results: unknown[] = [];
    for (const item of items) {
      const { project: next, result, error } = placeOne(project, item);
      project = next;
      results.push(error ? { componentId: item.componentId, error } : result);
    }
    writeProject(project);
    return ok({ results, violations: ops.getViolations(project) });
  }
);

server.tool(
  'move_item',
  'Move and/or rotate an existing placed instance. Only the fields you pass change — omit x/y/z/' +
    'rotation to leave them as-is. Same coordinate convention as place_item.',
  {
    instanceId: z.string(),
    x: z.number().optional(),
    y: z.number().optional(),
    z: z.number().optional(),
    rotation: rotationSchema.optional(),
  },
  async ({ instanceId, x, y, z, rotation }): Promise<CallToolResult> => {
    const project = readProject();
    const inst = project.instances.find((i) => i.id === instanceId);
    if (!inst) return fail(`No placed instance with id "${instanceId}". Call get_layout for valid ids.`);
    const pos: Vec3 = { x: x ?? inst.pos.x, y: y ?? inst.pos.y, z: z ?? inst.pos.z };
    const patch: Partial<Omit<PlacedInstance, 'id'>> = { pos };
    if (rotation !== undefined) patch.rotationY = rotation;
    const next = ops.updateInstance(project, instanceId, patch);
    writeProject(next);
    const updated = next.instances.find((i) => i.id === instanceId)!;
    return ok({ instance: describeInstance(next, updated), violations: violationsFor(next, instanceId) });
  }
);

server.tool(
  'remove_item',
  'Remove a placed instance from the layout.',
  { instanceId: z.string() },
  async ({ instanceId }): Promise<CallToolResult> => {
    const project = readProject();
    if (!project.instances.some((i) => i.id === instanceId)) {
      return fail(`No placed instance with id "${instanceId}". Call get_layout for valid ids.`);
    }
    const next = ops.removeInstance(project, instanceId);
    writeProject(next);
    return ok({ removed: instanceId, violations: ops.getViolations(next) });
  }
);

server.tool(
  'check_conflicts',
  'Return the full list of current conflicts (collisions, out-of-bounds, cab-zone obstacles) — ' +
    'exactly the same detection the app\'s Conflicts panel uses.',
  {},
  async (): Promise<CallToolResult> => {
    const project = readProject();
    return ok({ violations: ops.getViolations(project) });
  }
);

server.tool(
  'snap_to_safe',
  'Move an out-of-bounds/colliding instance to the nearest position (same rotation, same mount ' +
    'plane) that resolves every conflict it\'s currently in — the exact search the app\'s "Snap to ' +
    'nearest safe spot" button uses. Returns moved:false if no valid position exists anywhere on ' +
    'its plane.',
  { instanceId: z.string() },
  async ({ instanceId }): Promise<CallToolResult> => {
    const project = readProject();
    if (!project.instances.some((i) => i.id === instanceId)) {
      return fail(`No placed instance with id "${instanceId}". Call get_layout for valid ids.`);
    }
    const result = ops.resolveInstance(project, instanceId);
    if (result.moved) writeProject(result.project);
    const updated = result.project.instances.find((i) => i.id === instanceId)!;
    return ok({
      moved: result.moved,
      instance: describeInstance(result.project, updated),
      violations: violationsFor(result.project, instanceId),
    });
  }
);

server.tool(
  'set_shell_dimensions',
  'Patch the van shell — interior length/width/height, wall framing + insulation thickness, ' +
    'ceiling framing, floor build-up, cab depth/seat size, rear/side door dimensions, and roof/' +
    'underbody clearance. All fields optional; only what you pass changes. All values in inches.',
  {
    name: z.string().optional(),
    interiorLength: z.number().positive().optional(),
    interiorWidth: z.number().positive().optional(),
    interiorHeight: z.number().positive().optional(),
    wallFramingThickness: z.number().min(0).optional(),
    insulationThickness: z.number().min(0).optional(),
    ceilingFramingThickness: z.number().min(0).optional(),
    floorBuildUpThickness: z.number().min(0).optional(),
    cabDepth: z.number().min(0).optional(),
    cabSeatWidth: z.number().min(0).optional(),
    cabSeatDepth: z.number().min(0).optional(),
    cabSeatHeight: z.number().min(0).optional(),
    rearDoorWidth: z.number().min(0).optional(),
    rearDoorHeight: z.number().min(0).optional(),
    sideDoorWidth: z.number().min(0).optional(),
    sideDoorHeight: z.number().min(0).optional(),
    sideDoorOffsetZ: z.number().min(0).optional(),
    sideDoorSide: z.enum(['left', 'right']).optional(),
    roofClearance: z.number().min(0).optional(),
    underbodyClearance: z.number().min(0).optional(),
  },
  async (patch): Promise<CallToolResult> => {
    const project = readProject();
    const next = ops.setShell(project, patch);
    writeProject(next);
    return ok({ shell: next.shell, violations: ops.getViolations(next) });
  }
);

server.tool(
  'save_variant',
  'Save the current live layout as a named snapshot, so you can compare multiple candidate ' +
    'layouts side by side instead of overwriting the one working layout every time.',
  { name: z.string().min(1) },
  async ({ name }): Promise<CallToolResult> => {
    const project = readProject();
    const saved = saveVariant(name, project);
    return ok({ saved });
  }
);

server.tool(
  'load_variant',
  'Load a previously saved variant and make it the active/live layout (this is what the running ' +
    'app and get_layout will show afterward).',
  { name: z.string().min(1) },
  async ({ name }): Promise<CallToolResult> => {
    let project: ProjectState;
    try {
      project = loadVariant(name);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
    writeProject(project);
    return ok({ loaded: name, shell: project.shell, instanceCount: project.instances.length, violations: ops.getViolations(project) });
  }
);

server.tool(
  'list_variants',
  'List all saved layout variants.',
  {},
  async (): Promise<CallToolResult> => {
    return ok({ variants: listVariants() });
  }
);

// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('van-builder MCP server failed to start:', err);
  process.exit(1);
});
