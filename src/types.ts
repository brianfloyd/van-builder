// All linear units are INCHES. Angles in degrees (yaw only, snapped to 90s).
// Coordinate frame: x = across width (0 = interior left wall), y = up from
// interior floor, z = along length (0 = interior front / cab-facing wall).

export type Category =
  | 'structure'
  | 'bed'
  | 'seating'
  | 'kitchen'
  | 'sink'
  | 'vanity'
  | 'shower'
  | 'toilet'
  | 'storage'
  | 'cabinet'
  | 'appliance'
  | 'electrical'
  | 'water'
  | 'plumbing'
  | 'lighting'
  | 'roof'
  | 'other';

export const CATEGORIES: Category[] = [
  'structure',
  'bed',
  'seating',
  'kitchen',
  'sink',
  'vanity',
  'shower',
  'toilet',
  'storage',
  'cabinet',
  'appliance',
  'electrical',
  'water',
  'plumbing',
  'lighting',
  'roof',
  'other',
];

export const CATEGORY_COLORS: Record<Category, string> = {
  structure: '#8d99ae',
  bed: '#6d8f6b',
  seating: '#b08968',
  kitchen: '#e07a5f',
  sink: '#4a919e',
  vanity: '#7b6d8d',
  shower: '#3a86ff',
  toilet: '#a4a4a4',
  storage: '#c9a227',
  cabinet: '#b5651d',
  appliance: '#ef476f',
  electrical: '#ffd166',
  water: '#118ab2',
  plumbing: '#5390d9',
  lighting: '#f4e04d',
  roof: '#06d6a0',
  other: '#adb5bd',
};

/** Which layout plane a component belongs to. 'roof' components live on the
 * roof's own footprint (solar, Starlink, vents, roof AC); 'underbody'
 * components live on the frame/undercarriage plane below the floor (water
 * tanks, other chassis-mounted gear). Each is planned as its own layer,
 * combined on top of / below the van in the same scene, with its own
 * independent collision checking. */
export type MountSurface = 'floor' | 'roof' | 'underbody';

export interface Dims {
  w: number; // across x (width) at rotation 0
  d: number; // along z (depth/length) at rotation 0
  h: number; // up y (height)
}

export interface ComponentDef {
  id: string;
  name: string;
  category: Category;
  dims: Dims;
  color?: string;
  notes?: string;
  /** Instances of defs sharing an overlapGroup are treated as designed
   * alternates (e.g. two sink options on the same vanity footprint) and are
   * allowed to overlap each other regardless of the category matrix. */
  overlapGroup?: string;
  standard?: boolean; // true for built-in starter defs
  /** 'floor' (default, inside the van) or 'roof' (its own layout plane on
   * top of the van — solar, Starlink, vents, roof AC, etc). */
  mountSurface?: MountSurface;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlacedInstance {
  id: string;
  defId: string;
  label?: string; // optional override display name, e.g. "Driver-side galley"
  /** x,z = footprint CENTER (stable under yaw rotation); y = BASE (bottom)
   * height above the van floor (y=0 at raw shell floor). */
  pos: Vec3;
  rotationY: 0 | 90 | 180 | 270;
  /** Explicit extra instance ids this one is allowed to overlap with, beyond
   * category-matrix / overlapGroup rules. */
  overlapWhitelist?: string[];
  locked?: boolean;
}

export interface VanShell {
  name: string;
  interiorLength: number; // z extent, cab wall to rear doors
  interiorWidth: number; // x extent, wall to wall at widest usable point
  interiorHeight: number; // y extent, floor to ceiling
  wallFramingThickness: number; // scaffold/furring strips on side + front + rear walls
  insulationThickness: number; // insulation layer, also on walls (in addition to framing)
  ceilingFramingThickness: number; // framing + insulation allowance overhead
  floorBuildUpThickness: number; // subfloor/insulation/vapor barrier on floor

  // --- Fixed van features (reference/visual + the cab is a hard build exclusion) ---
  // These are NOT subtracted from interiorLength/Width/Height above — the cab zone
  // is a separate, always-out-of-bounds region layered on top of the envelope, so
  // it never distorts the raw buildable-envelope numbers.
  /** Depth (z, from the very front wall) of the driver/passenger cab area.
   * Nothing may be built inside this zone. */
  cabDepth: number;
  /** Approximate front seat footprint, shown swiveled to face the rear (a common
   * camper-conversion setup) so you can plan around them. Visual only. */
  cabSeatWidth: number;
  cabSeatDepth: number;
  cabSeatHeight: number;

  // Rear swing doors — reference visualization only, doesn't constrain the envelope.
  rearDoorWidth: number;
  rearDoorHeight: number;

  // Side sliding door — reference visualization only. Dimensions/position are
  // configurable since they vary van to van.
  sideDoorWidth: number;
  sideDoorHeight: number;
  /** Distance from the front wall (z=0) to the door opening's forward edge. */
  sideDoorOffsetZ: number;
  sideDoorSide: 'left' | 'right';

  /** Height budget above the roof surface available for roof-mounted gear
   * (solar panels, Starlink, vents, roof AC). The roof layout plane sits at
   * y = interiorHeight, combined on top of the van in the same 3D scene. */
  roofClearance: number;

  /** Height budget below the floor available for undercarriage-mounted gear
   * (water tanks, etc). The zone also automatically stays clear of the front
   * ~cabDepth of the van, approximating the engine/transmission area. */
  underbodyClearance: number;
}

export type CameraView =
  | 'iso'
  | 'front'
  | 'back'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'roof'
  | 'underbody';

/** category -> category -> allowed to overlap */
export type OverlapMatrix = Record<string, Record<string, boolean>>;

export interface ProjectState {
  version: 1;
  shell: VanShell;
  defs: ComponentDef[];
  instances: PlacedInstance[];
  overlapMatrix: OverlapMatrix;
}
