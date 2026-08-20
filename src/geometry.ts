import type { ComponentDef, Dims, MountSurface, OverlapMatrix, PlacedInstance, VanShell, Vec3 } from './types';

export interface Envelope {
  // usable interior box after subtracting insulation/framing/floor/ceiling build-up
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  width: number;
  height: number;
  length: number;
}

/** The buildable envelope once wall framing/insulation and floor/ceiling
 * build-up eat into the raw interior dimensions of the van shell. */
export function computeEnvelope(shell: VanShell): Envelope {
  const wallEat = shell.wallFramingThickness + shell.insulationThickness;
  const minX = wallEat;
  const maxX = shell.interiorWidth - wallEat;
  const minZ = wallEat;
  const maxZ = shell.interiorLength - wallEat;
  const minY = shell.floorBuildUpThickness;
  const maxY = shell.interiorHeight - shell.ceilingFramingThickness;
  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    length: Math.max(0, maxZ - minZ),
  };
}

/** The roof layout plane, sitting directly on top of the van's ceiling —
 * combined into the same 3D scene/coordinate space as the interior, but its
 * own independent placement surface (solar, Starlink, vents, roof AC...).
 * Uses the same wall inset as the interior envelope so equipment doesn't
 * overhang the roof edges. */
export function computeRoofEnvelope(shell: VanShell): Envelope {
  const wallEat = shell.wallFramingThickness + shell.insulationThickness;
  const minX = wallEat;
  const maxX = shell.interiorWidth - wallEat;
  const minZ = wallEat;
  const maxZ = shell.interiorLength - wallEat;
  const minY = shell.interiorHeight;
  const maxY = shell.interiorHeight + Math.max(0, shell.roofClearance);
  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    length: Math.max(0, maxZ - minZ),
  };
}

/** The undercarriage layout plane, below the floor — water tanks and other
 * chassis-mounted gear. Kept deliberately simple: a shallow box under the
 * floor that also stays clear of the front `cabDepth`, a rough stand-in for
 * the engine/transmission area (exact drivetrain geometry is out of scope
 * for now — this just keeps tank placement sane by default). */
export function computeUnderbodyEnvelope(shell: VanShell): Envelope {
  const wallEat = shell.wallFramingThickness + shell.insulationThickness;
  const minX = wallEat;
  const maxX = shell.interiorWidth - wallEat;
  const minZ = Math.max(wallEat, shell.cabDepth);
  const maxZ = shell.interiorLength - wallEat;
  const maxY = 0;
  const minY = -Math.max(0, shell.underbodyClearance);
  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    length: Math.max(0, maxZ - minZ),
  };
}

export function envelopeFor(shell: VanShell, mountSurface: MountSurface | undefined): Envelope {
  switch (mountSurface) {
    case 'roof':
      return computeRoofEnvelope(shell);
    case 'underbody':
      return computeUnderbodyEnvelope(shell);
    default:
      return computeEnvelope(shell);
  }
}

function surfaceOf(def: ComponentDef | undefined): MountSurface {
  return def?.mountSurface ?? 'floor';
}

/** Fixed cab/front-seat exclusion zone, in the same absolute shell coordinates
 * as component placement. Deliberately NOT folded into computeEnvelope — it's
 * a hard build-exclusion region layered on top, not a dimension constraint. */
export function computeCabZone(shell: VanShell): AABB {
  return {
    minX: 0,
    maxX: shell.interiorWidth,
    minY: 0,
    maxY: shell.interiorHeight,
    minZ: 0,
    maxZ: Math.max(0, shell.cabDepth),
  };
}

/** Footprint dims after applying a 90-degree-snapped yaw rotation. */
export function rotatedDims(dims: Dims, rotationY: number): Dims {
  const turned = ((rotationY % 180) + 180) % 180 === 90;
  return turned ? { w: dims.d, d: dims.w, h: dims.h } : { ...dims };
}

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export function instanceAABB(instance: PlacedInstance, def: ComponentDef): AABB {
  const dims = rotatedDims(def.dims, instance.rotationY);
  return {
    minX: instance.pos.x - dims.w / 2,
    maxX: instance.pos.x + dims.w / 2,
    minY: instance.pos.y,
    maxY: instance.pos.y + dims.h,
    minZ: instance.pos.z - dims.d / 2,
    maxZ: instance.pos.z + dims.d / 2,
  };
}

export function aabbIntersects(a: AABB, b: AABB, epsilon = 1e-6): boolean {
  return (
    a.minX < b.maxX - epsilon &&
    a.maxX > b.minX + epsilon &&
    a.minY < b.maxY - epsilon &&
    a.maxY > b.minY + epsilon &&
    a.minZ < b.maxZ - epsilon &&
    a.maxZ > b.minZ + epsilon
  );
}

export function aabbWithinEnvelope(box: AABB, env: Envelope, epsilon = 1e-6): boolean {
  return (
    box.minX >= env.minX - epsilon &&
    box.maxX <= env.maxX + epsilon &&
    box.minY >= env.minY - epsilon &&
    box.maxY <= env.maxY + epsilon &&
    box.minZ >= env.minZ - epsilon &&
    box.maxZ <= env.maxZ + epsilon
  );
}

/** Is an overlap between these two instances considered "designed", i.e.
 * intentional/allowed, rather than a real collision? */
export function overlapIsAllowed(
  a: PlacedInstance,
  aDef: ComponentDef,
  b: PlacedInstance,
  bDef: ComponentDef,
  matrix: OverlapMatrix
): boolean {
  if (a.overlapWhitelist?.includes(b.id) || b.overlapWhitelist?.includes(a.id)) return true;
  if (aDef.overlapGroup && aDef.overlapGroup === bDef.overlapGroup) return true;
  const row = matrix[aDef.category];
  if (row && row[bDef.category]) return true;
  const row2 = matrix[bDef.category];
  if (row2 && row2[aDef.category]) return true;
  return false;
}

export interface Violation {
  type: 'collision' | 'out-of-bounds' | 'obstacle';
  instanceIds: string[];
  message: string;
}

export function findViolations(
  instances: PlacedInstance[],
  defs: Record<string, ComponentDef>,
  shell: VanShell,
  matrix: OverlapMatrix
): Violation[] {
  const envBySurface: Record<MountSurface, Envelope> = {
    floor: computeEnvelope(shell),
    roof: computeRoofEnvelope(shell),
    underbody: computeUnderbodyEnvelope(shell),
  };
  const envelopeLabel: Record<MountSurface, string> = {
    floor: 'buildable',
    roof: 'roof',
    underbody: 'underbody',
  };
  const cabZone = computeCabZone(shell);
  const violations: Violation[] = [];

  for (const inst of instances) {
    const def = defs[inst.defId];
    if (!def) continue;
    const surface = surfaceOf(def);
    const env = envBySurface[surface];
    const box = instanceAABB(inst, def);
    if (!aabbWithinEnvelope(box, env)) {
      violations.push({
        type: 'out-of-bounds',
        instanceIds: [inst.id],
        message: `${inst.label ?? def.name} extends outside the ${envelopeLabel[surface]} envelope`,
      });
    }
    if (surface === 'floor' && aabbIntersects(box, cabZone)) {
      violations.push({
        type: 'obstacle',
        instanceIds: [inst.id],
        message: `${inst.label ?? def.name} overlaps the cab / front seat area`,
      });
    }
  }

  // Only compare items on the same mount surface — a roof solar panel and an
  // interior bed occupy entirely different physical planes and never collide.
  for (let i = 0; i < instances.length; i++) {
    for (let j = i + 1; j < instances.length; j++) {
      const a = instances[i];
      const b = instances[j];
      const aDef = defs[a.defId];
      const bDef = defs[b.defId];
      if (!aDef || !bDef) continue;
      if (surfaceOf(aDef) !== surfaceOf(bDef)) continue;
      const boxA = instanceAABB(a, aDef);
      const boxB = instanceAABB(b, bDef);
      if (aabbIntersects(boxA, boxB) && !overlapIsAllowed(a, aDef, b, bDef, matrix)) {
        violations.push({
          type: 'collision',
          instanceIds: [a.id, b.id],
          message: `${a.label ?? aDef.name} overlaps ${b.label ?? bDef.name}`,
        });
      }
    }
  }

  return violations;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.min(hi, Math.max(lo, hi)));
}

/** Snap a position to a grid increment (inches). */
export function snap(v: number, grid: number): number {
  if (grid <= 0) return v;
  return Math.round(v / grid) * grid;
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

/**
 * Find the closest conflict-free position for `target` (same rotation, same
 * footprint) — used by the "snap to nearest safe spot" recovery action.
 * Searches the floor plane (X/Z) around the item's current position first
 * (expanding ring search), since that resolves the overwhelming majority of
 * real layout conflicts without relocating the item vertically; only falls
 * back to scanning other heights if nothing on the current level works.
 * Returns null if no valid position exists anywhere in the envelope.
 */
export function findNearestValidPosition(
  target: PlacedInstance,
  targetDef: ComponentDef,
  others: PlacedInstance[],
  defsById: Record<string, ComponentDef>,
  shell: VanShell,
  matrix: OverlapMatrix,
  stepIn = 2
): Vec3 | null {
  const surface = surfaceOf(targetDef);
  const env = envelopeFor(shell, targetDef.mountSurface);
  const obstacles: AABB[] = surface === 'floor' ? [computeCabZone(shell)] : [];
  const dims = rotatedDims(targetDef.dims, target.rotationY);
  const halfW = dims.w / 2;
  const halfD = dims.d / 2;

  const minCx = env.minX + halfW;
  const maxCx = env.maxX - halfW;
  const minCz = env.minZ + halfD;
  const maxCz = env.maxZ - halfD;
  const minY = env.minY;
  const maxY = env.maxY - dims.h;
  if (minCx > maxCx || minCz > maxCz || minY > maxY) return null; // doesn't fit at all

  const others2 = others.filter((o) => o.id !== target.id && surfaceOf(defsById[o.defId]) === surface);

  function isValid(x: number, y: number, z: number): boolean {
    const box: AABB = { minX: x - halfW, maxX: x + halfW, minY: y, maxY: y + dims.h, minZ: z - halfD, maxZ: z + halfD };
    if (!aabbWithinEnvelope(box, env)) return false;
    for (const obs of obstacles) if (aabbIntersects(box, obs)) return false;
    for (const other of others2) {
      const oDef = defsById[other.defId];
      if (!oDef) continue;
      const oBox = instanceAABB(other, oDef);
      if (aabbIntersects(box, oBox) && !overlapIsAllowed(target, targetDef, other, oDef, matrix)) return false;
    }
    return true;
  }

  const startX = clamp(target.pos.x, minCx, maxCx);
  const startZ = clamp(target.pos.z, minCz, maxCz);
  const startY = clamp(target.pos.y, minY, maxY);

  if (isValid(startX, startY, startZ)) return { x: startX, y: startY, z: startZ };

  const maxRadius = Math.max(env.width, env.length) + stepIn;
  for (let r = stepIn; r <= maxRadius; r += stepIn) {
    const candidates: { x: number; z: number; dist: number }[] = [];
    for (let dx = -r; dx <= r; dx += stepIn) {
      for (let dz = -r; dz <= r; dz += stepIn) {
        // Only the outer ring at this radius — inner points were already tried.
        if (Math.max(Math.abs(dx), Math.abs(dz)) < r - stepIn / 2) continue;
        const x = clamp(startX + dx, minCx, maxCx);
        const z = clamp(startZ + dz, minCz, maxCz);
        candidates.push({ x, z, dist: Math.hypot(dx, dz) });
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);
    for (const c of candidates) {
      if (isValid(c.x, startY, c.z)) return { x: c.x, y: startY, z: c.z };
    }
  }

  // Last resort: sweep other floor heights too (rare — very cluttered van).
  const yStep = Math.max(stepIn, Math.min(dims.h, 6));
  for (let y = minY; y <= maxY + 1e-6; y += yStep) {
    for (let x = minCx; x <= maxCx + 1e-6; x += stepIn * 2) {
      for (let z = minCz; z <= maxCz + 1e-6; z += stepIn * 2) {
        if (isValid(x, y, z)) return { x, y, z };
      }
    }
  }

  return null;
}
