import { describe, expect, it } from 'vitest';
import { DEFAULT_SHELL } from './defaultData';
import {
  aabbIntersects,
  clamp,
  clampToCeiling,
  computeCabZone,
  computeEnvelope,
  computeWheelWellZones,
  ceilingHangY,
  findNearestValidPosition,
  physicalPlane,
  snap,
} from './geometry';
import type { ComponentDef, PlacedInstance } from './types';

describe('computeEnvelope', () => {
  it('subtracts wall, floor, and ceiling build-up from the ProMaster shell', () => {
    const env = computeEnvelope(DEFAULT_SHELL);
    const wall = DEFAULT_SHELL.wallFramingThickness + DEFAULT_SHELL.insulationThickness;
    expect(env.minX).toBe(wall);
    expect(env.maxX).toBe(DEFAULT_SHELL.interiorWidth - wall);
    expect(env.minY).toBe(DEFAULT_SHELL.floorBuildUpThickness);
    expect(env.maxY).toBe(DEFAULT_SHELL.interiorHeight - DEFAULT_SHELL.ceilingFramingThickness);
    expect(env.width).toBeGreaterThan(0);
    expect(env.length).toBeGreaterThan(0);
  });
});

describe('physicalPlane', () => {
  it('maps mount surfaces onto the four physical planes', () => {
    expect(physicalPlane('floor')).toBe('interior');
    expect(physicalPlane('ceiling')).toBe('interior');
    expect(physicalPlane('roof')).toBe('roof');
    expect(physicalPlane('underbody')).toBe('underbody');
    expect(physicalPlane('door')).toBe('door');
  });
});

describe('aabbIntersects', () => {
  it('detects overlapping boxes and ignores separated ones', () => {
    const a = { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 10 };
    const b = { minX: 5, maxX: 15, minY: 0, maxY: 10, minZ: 0, maxZ: 10 };
    const c = { minX: 20, maxX: 30, minY: 0, maxY: 10, minZ: 0, maxZ: 10 };
    expect(aabbIntersects(a, b)).toBe(true);
    expect(aabbIntersects(a, c)).toBe(false);
  });
});

describe('snap / clamp', () => {
  it('snaps to a half-inch grid and clamps into range', () => {
    expect(snap(10.24, 0.5)).toBe(10);
    expect(snap(10.26, 0.5)).toBe(10.5);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('cab and wheel-well exclusion', () => {
  it('cab zone occupies the front cabDepth of the interior', () => {
    const cab = computeCabZone(DEFAULT_SHELL);
    expect(cab.minZ).toBe(0);
    expect(cab.maxZ).toBe(DEFAULT_SHELL.cabDepth);
  });
  it('wheel wells intrude from both side walls', () => {
    const wells = computeWheelWellZones(DEFAULT_SHELL);
    expect(wells.length).toBe(2);
    expect(wells[0].box.minX).toBe(0);
    expect(wells[1].box.maxX).toBe(DEFAULT_SHELL.interiorWidth);
  });
});

describe('ceiling hang', () => {
  const def: ComponentDef = {
    id: 'rail',
    name: 'Rail',
    category: 'other',
    standard: true,
    dims: { w: 10, d: 10, h: 4 },
    mountSurface: 'ceiling',
  };
  const target: PlacedInstance = {
    id: 'a',
    defId: 'rail',
    pos: { x: 30, y: 50, z: 80 },
    rotationY: 0,
  };

  it('hangs from the interior ceiling when nothing is above', () => {
    const hang = ceilingHangY(DEFAULT_SHELL, def.dims, 30, 80, target, def, [], { rail: def });
    const env = computeEnvelope(DEFAULT_SHELL);
    expect(hang).toBe(env.maxY);
  });

  it('clampToCeiling sets Y so the top is pressed against the hang height', () => {
    const pos = clampToCeiling(DEFAULT_SHELL, def.dims, { x: 30, y: 0, z: 80 }, target, def, [], {
      rail: def,
    });
    const env = computeEnvelope(DEFAULT_SHELL);
    expect(pos.y).toBeCloseTo(env.maxY - def.dims.h);
  });
});

describe('findNearestValidPosition', () => {
  it('returns a position inside the envelope for a small floor item', () => {
    const boxDef: ComponentDef = {
      id: 'box',
      name: 'Box',
      category: 'storage',
      standard: true,
      dims: { w: 12, d: 12, h: 12 },
      mountSurface: 'floor',
    };
    const inst: PlacedInstance = {
      id: 'b1',
      defId: 'box',
      pos: { x: 200, y: 1.5, z: 200 },
      rotationY: 0,
    };
    const found = findNearestValidPosition(
      inst,
      boxDef,
      [],
      { box: boxDef },
      DEFAULT_SHELL,
      {},
      4
    );
    expect(found).not.toBeNull();
    const env = computeEnvelope(DEFAULT_SHELL);
    expect(found!.x).toBeGreaterThanOrEqual(env.minX);
    expect(found!.x).toBeLessThanOrEqual(env.maxX);
    expect(found!.z).toBeGreaterThanOrEqual(DEFAULT_SHELL.cabDepth);
  });
});
