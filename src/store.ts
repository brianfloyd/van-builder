import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { CameraView, ComponentDef, OverlapMatrix, PlacedInstance, ProjectState, VanShell, Vec3 } from './types';
import { DEFAULT_DEFS, DEFAULT_SHELL, buildDefaultOverlapMatrix } from './defaultData';
import { clamp, envelopeFor, findNearestValidPosition, findViolations, snap, type Violation } from './geometry';

const STORAGE_KEY = 'van-builder-project-v1';
export const GRID_SNAP = 0.5; // inches

interface StoreState {
  shell: VanShell;
  defs: ComponentDef[];
  instances: PlacedInstance[];
  overlapMatrix: OverlapMatrix;
  selectedInstanceId: string | null;

  /** Door open/closed state for space-clearance simulation. Transient UI
   * state — not persisted with the project. */
  doorsOpen: { rear: boolean; side: boolean };
  toggleDoor: (which: 'rear' | 'side') => void;

  /** One-shot camera-snap request consumed by the Scene. Always a fresh
   * object so requesting the same view twice in a row still fires. */
  cameraViewRequest: { view: CameraView; nonce: number } | null;
  requestCameraView: (view: CameraView) => void;

  setShell: (patch: Partial<VanShell>) => void;

  addDef: (def: Omit<ComponentDef, 'id'>) => string;
  updateDef: (id: string, patch: Partial<ComponentDef>) => void;
  removeDef: (id: string) => void;

  addInstance: (defId: string) => string;
  updateInstance: (id: string, patch: Partial<Omit<PlacedInstance, 'id'>>) => void;
  moveInstance: (id: string, delta: Partial<Vec3>) => void;
  removeInstance: (id: string) => void;
  selectInstance: (id: string | null) => void;
  duplicateInstance: (id: string) => void;
  /** Snap an out-of-bounds/colliding instance to the nearest conflict-free
   * position (same rotation). Returns false if none could be found. */
  resolveInstance: (id: string) => boolean;

  setOverlapAllowed: (catA: string, catB: string, allowed: boolean) => void;

  violations: () => Violation[];
  defsById: () => Record<string, ComponentDef>;

  exportProject: () => ProjectState;
  importProject: (data: ProjectState) => void;
  resetToDefaults: () => void;
}

function loadInitial(): Pick<StoreState, 'shell' | 'defs' | 'instances' | 'overlapMatrix'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectState;
      if (parsed && parsed.shell && parsed.defs) {
        return {
          // Merge onto defaults so a project saved before a shell field was
          // added (e.g. cab/door dimensions) doesn't load with `undefined`s.
          shell: { ...DEFAULT_SHELL, ...parsed.shell },
          defs: parsed.defs,
          instances: parsed.instances ?? [],
          overlapMatrix: parsed.overlapMatrix ?? buildDefaultOverlapMatrix(),
        };
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return {
    shell: DEFAULT_SHELL,
    defs: DEFAULT_DEFS,
    instances: [],
    overlapMatrix: buildDefaultOverlapMatrix(),
  };
}

function persist(state: Pick<StoreState, 'shell' | 'defs' | 'instances' | 'overlapMatrix'>) {
  const project: ProjectState = {
    version: 1,
    shell: state.shell,
    defs: state.defs,
    instances: state.instances,
    overlapMatrix: state.overlapMatrix,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // storage full/unavailable — ignore
  }
}

export const useStore = create<StoreState>((set, get) => ({
  ...loadInitial(),
  selectedInstanceId: null,

  doorsOpen: { rear: false, side: false },
  toggleDoor: (which) =>
    set((s) => ({ doorsOpen: { ...s.doorsOpen, [which]: !s.doorsOpen[which] } })),

  cameraViewRequest: null,
  requestCameraView: (view) => set({ cameraViewRequest: { view, nonce: Date.now() + Math.random() } }),

  setShell: (patch) =>
    set((s) => {
      const shell = { ...s.shell, ...patch };
      persist({ ...s, shell });
      return { shell };
    }),

  addDef: (def) => {
    const id = uuid();
    set((s) => {
      const defs = [...s.defs, { ...def, id }];
      persist({ ...s, defs });
      return { defs };
    });
    return id;
  },

  updateDef: (id, patch) =>
    set((s) => {
      const defs = s.defs.map((d) => (d.id === id ? { ...d, ...patch } : d));
      persist({ ...s, defs });
      return { defs };
    }),

  removeDef: (id) =>
    set((s) => {
      const defs = s.defs.filter((d) => d.id !== id);
      const instances = s.instances.filter((i) => i.defId !== id);
      persist({ ...s, defs, instances });
      return { defs, instances };
    }),

  addInstance: (defId) => {
    const id = uuid();
    set((s) => {
      const def = s.defs.find((d) => d.id === defId);
      const env = envelopeFor(s.shell, def?.mountSurface);
      // Place new instance centered-ish in the envelope, nudged so repeated
      // adds don't stack exactly on top of one another.
      const count = s.instances.filter((i) => i.defId === defId).length;
      const w = def?.dims.w ?? 12;
      const d = def?.dims.d ?? 12;
      const cx = env.minX + w / 2;
      const cz = env.minZ + d / 2;
      // Snapping to the grid can round a corner-hugging position a hair
      // outside the envelope — clamp again after snapping to guarantee a
      // freshly-added instance never starts out of bounds.
      const x = clamp(snap(Math.min(cx + count * 4, Math.max(cx, env.maxX - w / 2)), GRID_SNAP), env.minX + w / 2, env.maxX - w / 2);
      const z = clamp(snap(Math.min(cz + count * 4, Math.max(cz, env.maxZ - d / 2)), GRID_SNAP), env.minZ + d / 2, env.maxZ - d / 2);
      const y = clamp(snap(env.minY, GRID_SNAP), env.minY, env.maxY);
      const instance: PlacedInstance = { id, defId, pos: { x, y, z }, rotationY: 0 };
      const instances = [...s.instances, instance];
      persist({ ...s, instances });
      return { instances, selectedInstanceId: id };
    });
    return id;
  },

  updateInstance: (id, patch) =>
    set((s) => {
      const instances = s.instances.map((i) => (i.id === id ? { ...i, ...patch } : i));
      persist({ ...s, instances });
      return { instances };
    }),

  moveInstance: (id, delta) =>
    set((s) => {
      const instances = s.instances.map((i) => {
        if (i.id !== id) return i;
        return {
          ...i,
          pos: {
            x: snap(i.pos.x + (delta.x ?? 0), GRID_SNAP),
            y: snap(i.pos.y + (delta.y ?? 0), GRID_SNAP),
            z: snap(i.pos.z + (delta.z ?? 0), GRID_SNAP),
          },
        };
      });
      persist({ ...s, instances });
      return { instances };
    }),

  removeInstance: (id) =>
    set((s) => {
      const instances = s.instances.filter((i) => i.id !== id);
      persist({ ...s, instances });
      return { instances, selectedInstanceId: s.selectedInstanceId === id ? null : s.selectedInstanceId };
    }),

  selectInstance: (id) => set({ selectedInstanceId: id }),

  duplicateInstance: (id) => {
    const s = get();
    const src = s.instances.find((i) => i.id === id);
    if (!src) return;
    const newId = uuid();
    const copy: PlacedInstance = {
      ...src,
      id: newId,
      pos: { x: src.pos.x + 2, y: src.pos.y, z: src.pos.z + 2 },
    };
    set((st) => {
      const instances = [...st.instances, copy];
      persist({ ...st, instances });
      return { instances, selectedInstanceId: newId };
    });
  },

  resolveInstance: (id) => {
    const s = get();
    const target = s.instances.find((i) => i.id === id);
    const def = s.defs.find((d) => d.id === target?.defId);
    if (!target || !def) return false;
    const result = findNearestValidPosition(target, def, s.instances, get().defsById(), s.shell, s.overlapMatrix);
    if (!result) return false;
    get().updateInstance(id, { pos: result });
    return true;
  },

  setOverlapAllowed: (catA, catB, allowed) =>
    set((s) => {
      const overlapMatrix: OverlapMatrix = JSON.parse(JSON.stringify(s.overlapMatrix));
      (overlapMatrix[catA] ??= {})[catB] = allowed;
      (overlapMatrix[catB] ??= {})[catA] = allowed;
      persist({ ...s, overlapMatrix });
      return { overlapMatrix };
    }),

  violations: () => {
    const s = get();
    const defsById = Object.fromEntries(s.defs.map((d) => [d.id, d]));
    return findViolations(s.instances, defsById, s.shell, s.overlapMatrix);
  },

  defsById: () => {
    const s = get();
    return Object.fromEntries(s.defs.map((d) => [d.id, d]));
  },

  exportProject: () => {
    const s = get();
    return { version: 1, shell: s.shell, defs: s.defs, instances: s.instances, overlapMatrix: s.overlapMatrix };
  },

  importProject: (data) =>
    set(() => {
      const next = {
        shell: { ...DEFAULT_SHELL, ...data.shell },
        defs: data.defs,
        instances: data.instances ?? [],
        overlapMatrix: data.overlapMatrix ?? buildDefaultOverlapMatrix(),
      };
      persist(next);
      return { ...next, selectedInstanceId: null };
    }),

  resetToDefaults: () =>
    set(() => {
      const next = {
        shell: DEFAULT_SHELL,
        defs: DEFAULT_DEFS,
        instances: [],
        overlapMatrix: buildDefaultOverlapMatrix(),
      };
      persist(next);
      return { ...next, selectedInstanceId: null };
    }),
}));
