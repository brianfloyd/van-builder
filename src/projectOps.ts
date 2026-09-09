// Framework-agnostic core: pure functions that read/mutate a ProjectState,
// with zero React/zustand/DOM/Node dependencies (same spirit as geometry.ts,
// which this module builds on). This is the ONE place placement, editing,
// and normalization logic lives — src/store.ts (the browser app) and
// mcp-server/ (the MCP file-bridge server) both call these functions rather
// than each having their own copy, so the two can't silently drift.
//
// Phase-2 note: because this file and geometry.ts have no browser- or
// Node-specific imports, a future live-sync server (WebSocket push instead
// of the Phase-1 file-watch bridge) can import them directly too — nothing
// here needs to be extracted or rewritten to get there.

import { v4 as uuid } from 'uuid';
import type { ComponentDef, DoorId, OverlapMatrix, PlacedInstance, ProjectState, VanShell, Vec3 } from './types';
import {
  clamp,
  clampToCeiling,
  clampToDoorPanel,
  computeClearances,
  computeDoorEnvelope,
  envelopeFor,
  findNearestValidPosition,
  findViolations,
  requiredDoorTouchZ,
  rotatedDims,
  snap,
  type Clearances,
  type Violation,
} from './geometry';

/** Door-mount instances must stay flush against their panel — this re-clamps
 * X/Y into the panel bounds and forces Z back to the touching position after
 * ANY change to a door-mount instance's position, rotation, or doorId. Not
 * just a validity check: the constraint is enforced here so "moved away from
 * the exterior" is unreachable, not just flagged red. No-op for every other
 * mount surface. */
function reclampDoorInstance(project: ProjectState, inst: PlacedInstance): PlacedInstance {
  const def = project.defs.find((d) => d.id === inst.defId);
  if (!def) return inst;
  const surface = def.mountSurface ?? 'floor';
  if (surface === 'ceiling') {
    const dims = rotatedDims(def.dims, inst.rotationY);
    const pos = clampToCeiling(project.shell, dims, inst.pos, inst, def, project.instances, defsById(project));
    return { ...inst, pos };
  }
  if (surface !== 'door') return inst;
  const doorId: DoorId = inst.doorId ?? 'rear-left';
  const dims = rotatedDims(def.dims, inst.rotationY);
  const pos = clampToDoorPanel(project.shell, doorId, dims, inst.pos);
  return { ...inst, doorId, pos };
}

/** Ceiling-hung items derive their Y from whatever is above them, so ANY
 * change to the layout (a bed platform lowered, a cabinet removed, a def's
 * dims/mountSurface edited, the shell's ceiling build-up changed) can
 * change where they must sit. Every mutation below runs its result through
 * this so ceiling items are always re-hung — that's what makes a rail
 * bolted under a lift bed follow the bed down. Cheap: a no-op pass when
 * nothing is ceiling-mounted. */
function rehangCeilingInstances(project: ProjectState): ProjectState {
  const byId = defsById(project);
  if (!project.instances.some((i) => (byId[i.defId]?.mountSurface ?? 'floor') === 'ceiling')) return project;
  let changed = false;
  const instances = project.instances.map((inst) => {
    const def = byId[inst.defId];
    if (!def || (def.mountSurface ?? 'floor') !== 'ceiling') return inst;
    const dims = rotatedDims(def.dims, inst.rotationY);
    const pos = clampToCeiling(project.shell, dims, inst.pos, inst, def, project.instances, byId);
    if (pos.x === inst.pos.x && pos.y === inst.pos.y && pos.z === inst.pos.z) return inst;
    changed = true;
    return { ...inst, pos };
  });
  return changed ? { ...project, instances } : project;
}

export const GRID_SNAP = 0.5; // inches — shared placement/nudge grid

export interface ProjectDefaults {
  shell: VanShell;
  defs: ComponentDef[];
  /** Factory, not a value — callers must get a fresh object each time so
   * separate projects never share (and accidentally mutate) one matrix. */
  buildOverlapMatrix: () => OverlapMatrix;
}

/**
 * Merge possibly-partial / older-schema project data onto current defaults,
 * so a project saved before a shell field existed (or with defs/instances
 * missing) loads without `undefined`s. This is THE serialization/import
 * boundary for the whole app: the browser's localStorage load, its
 * Export/Import JSON feature, and the MCP file-bridge all call this same
 * function instead of each reimplementing the merge.
 */
export function normalizeProject(data: unknown, defaults: ProjectDefaults): ProjectState {
  const parsed = data as Partial<ProjectState> | null | undefined;
  if (!parsed || typeof parsed !== 'object' || !parsed.shell || !parsed.defs) {
    return {
      version: 1,
      shell: defaults.shell,
      defs: defaults.defs,
      instances: [],
      overlapMatrix: defaults.buildOverlapMatrix(),
    };
  }
  return {
    version: 1,
    shell: { ...defaults.shell, ...parsed.shell },
    defs: parsed.defs,
    instances: parsed.instances ?? [],
    overlapMatrix: parsed.overlapMatrix ?? defaults.buildOverlapMatrix(),
  };
}

export function defsById(project: ProjectState): Record<string, ComponentDef> {
  return Object.fromEntries(project.defs.map((d) => [d.id, d]));
}

/** Reuses geometry.ts's findViolations directly — never reimplemented. */
export function getViolations(project: ProjectState): Violation[] {
  return findViolations(project.instances, defsById(project), project.shell, project.overlapMatrix);
}

/** Distance from a placed instance to its nearest same-plane obstacle (or
 * envelope wall) in each of the 6 directions. Reuses geometry.ts's
 * computeClearances directly. Returns null if the instance doesn't exist. */
export function getClearances(project: ProjectState, instanceId: string): Clearances | null {
  const target = project.instances.find((i) => i.id === instanceId);
  const def = project.defs.find((d) => d.id === target?.defId);
  if (!target || !def) return null;
  return computeClearances(target, def, project.instances, defsById(project), project.shell, project.overlapMatrix);
}

export function setShell(project: ProjectState, patch: Partial<VanShell>): ProjectState {
  return rehangCeilingInstances({ ...project, shell: { ...project.shell, ...patch } });
}

export function addDef(project: ProjectState, def: Omit<ComponentDef, 'id'>): { project: ProjectState; id: string } {
  const id = uuid();
  return { project: { ...project, defs: [...project.defs, { ...def, id }] }, id };
}

export function updateDef(project: ProjectState, id: string, patch: Partial<ComponentDef>): ProjectState {
  return rehangCeilingInstances({ ...project, defs: project.defs.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
}

export function removeDef(project: ProjectState, id: string): ProjectState {
  return rehangCeilingInstances({
    ...project,
    defs: project.defs.filter((d) => d.id !== id),
    instances: project.instances.filter((i) => i.defId !== id),
  });
}

export interface InstanceResult {
  project: ProjectState;
  instance: PlacedInstance;
}
export interface OpError {
  error: string;
}

/** Same corner-staggered auto-placement the Catalog panel's "+" button uses
 * (repeated adds of the same type nudge apart instead of stacking exactly). */
export function addInstance(project: ProjectState, defId: string): InstanceResult | OpError {
  const def = project.defs.find((d) => d.id === defId);
  if (!def) return { error: `No component def with id "${defId}"` };

  if ((def.mountSurface ?? 'floor') === 'door') {
    const doorId: DoorId = 'rear-left';
    const count = project.instances.filter((i) => i.defId === defId && (i.doorId ?? 'rear-left') === doorId).length;
    const env = computeDoorEnvelope(project.shell, doorId, def.dims.d);
    const halfW = def.dims.w / 2;
    const cx = clamp(env.minX + halfW + count * 4, env.minX + halfW, Math.max(env.minX + halfW, env.maxX - halfW));
    const z = requiredDoorTouchZ(project.shell, def.dims.d);
    const instance: PlacedInstance = {
      id: uuid(),
      defId,
      pos: { x: snap(cx, GRID_SNAP), y: snap(env.minY, GRID_SNAP), z },
      rotationY: 0,
      doorId,
    };
    return { project: { ...project, instances: [...project.instances, instance] }, instance };
  }

  const env = envelopeFor(project.shell, def.mountSurface);
  const count = project.instances.filter((i) => i.defId === defId).length;
  const w = def.dims.w;
  const d = def.dims.d;
  const cx = env.minX + w / 2;
  const cz = env.minZ + d / 2;
  // Snapping to the grid can round a corner-hugging position a hair outside
  // the envelope — clamp again after snapping so a freshly-added instance
  // never starts out of bounds.
  const x = clamp(
    snap(Math.min(cx + count * 4, Math.max(cx, env.maxX - w / 2)), GRID_SNAP),
    env.minX + w / 2,
    env.maxX - w / 2
  );
  const z = clamp(
    snap(Math.min(cz + count * 4, Math.max(cz, env.maxZ - d / 2)), GRID_SNAP),
    env.minZ + d / 2,
    env.maxZ - d / 2
  );
  const y = clamp(snap(env.minY, GRID_SNAP), env.minY, env.maxY);
  // Ceiling items: Y is derived (top pressed against the ceiling / what's
  // above), so re-clamp the fresh instance instead of leaving it on the floor.
  const instance: PlacedInstance = reclampDoorInstance(project, { id: uuid(), defId, pos: { x, y, z }, rotationY: 0 });
  return { project: { ...project, instances: [...project.instances, instance] }, instance };
}

/** Place an instance at an EXACT position/rotation the caller chose — what
 * the MCP server's place_item/place_items use, as opposed to addInstance's
 * auto-staggered default corner placement. `pos` follows the same
 * convention as everywhere else: x/z are the footprint CENTER, y is the
 * BASE height on whichever plane the def's mountSurface resolves to. */
export function placeInstanceAt(
  project: ProjectState,
  defId: string,
  pos: Vec3,
  rotationY: 0 | 90 | 180 | 270 = 0,
  doorId?: DoorId
): InstanceResult | OpError {
  const def = project.defs.find((d) => d.id === defId);
  if (!def) return { error: `No component def with id "${defId}"` };
  let instance: PlacedInstance = { id: uuid(), defId, pos, rotationY };
  if ((def.mountSurface ?? 'floor') === 'door') instance.doorId = doorId ?? 'rear-left';
  instance = reclampDoorInstance(project, instance);
  const next = rehangCeilingInstances({ ...project, instances: [...project.instances, instance] });
  return { project: next, instance: next.instances.find((i) => i.id === instance.id) ?? instance };
}

export function updateInstance(
  project: ProjectState,
  id: string,
  patch: Partial<Omit<PlacedInstance, 'id'>>
): ProjectState {
  return rehangCeilingInstances({
    ...project,
    instances: project.instances.map((i) => (i.id === id ? reclampDoorInstance(project, { ...i, ...patch }) : i)),
  });
}

export function moveInstanceDelta(project: ProjectState, id: string, delta: Partial<Vec3>): ProjectState {
  return rehangCeilingInstances({
    ...project,
    instances: project.instances.map((i) => {
      if (i.id !== id) return i;
      const pos: Vec3 = {
        x: snap(i.pos.x + (delta.x ?? 0), GRID_SNAP),
        y: snap(i.pos.y + (delta.y ?? 0), GRID_SNAP),
        z: snap(i.pos.z + (delta.z ?? 0), GRID_SNAP),
      };
      return reclampDoorInstance(project, { ...i, pos });
    }),
  });
}

export function removeInstance(project: ProjectState, id: string): ProjectState {
  return rehangCeilingInstances({ ...project, instances: project.instances.filter((i) => i.id !== id) });
}

export function duplicateInstance(project: ProjectState, id: string): InstanceResult | OpError {
  const src = project.instances.find((i) => i.id === id);
  if (!src) return { error: `No placed instance with id "${id}"` };
  const copy = reclampDoorInstance(project, {
    ...src,
    id: uuid(),
    pos: { x: src.pos.x + 2, y: src.pos.y, z: src.pos.z + 2 },
  });
  const next = rehangCeilingInstances({ ...project, instances: [...project.instances, copy] });
  return { project: next, instance: next.instances.find((i) => i.id === copy.id) ?? copy };
}

export interface ResolveResult {
  project: ProjectState;
  moved: boolean;
  pos?: Vec3;
}

/** Snap an out-of-bounds/colliding instance to the nearest conflict-free
 * position (same rotation) — reuses geometry.ts's findNearestValidPosition
 * directly, never reimplemented. */
export function resolveInstance(project: ProjectState, id: string): ResolveResult {
  const target = project.instances.find((i) => i.id === id);
  const def = project.defs.find((d) => d.id === target?.defId);
  if (!target || !def) return { project, moved: false };
  const result = findNearestValidPosition(
    target,
    def,
    project.instances,
    defsById(project),
    project.shell,
    project.overlapMatrix
  );
  if (!result) return { project, moved: false };
  return { project: updateInstance(project, id, { pos: result }), moved: true, pos: result };
}

export function setOverlapAllowed(project: ProjectState, catA: string, catB: string, allowed: boolean): ProjectState {
  const overlapMatrix: OverlapMatrix = JSON.parse(JSON.stringify(project.overlapMatrix));
  (overlapMatrix[catA] ??= {})[catB] = allowed;
  (overlapMatrix[catB] ??= {})[catA] = allowed;
  return { ...project, overlapMatrix };
}
