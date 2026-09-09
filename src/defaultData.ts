import { v4 as uuid } from 'uuid';
import type { ComponentDef, OverlapMatrix, VanShell } from './types';

export const DEFAULT_SHELL: VanShell = {
  name: 'Ram ProMaster 159" EXT High Roof',
  interiorLength: 160.2,
  interiorWidth: 75.6, // max width at wall; narrows to ~55.8" between wheel arches — see wheelWell* below
  interiorHeight: 76,
  wallFramingThickness: 0.75, // furring strip / scaffold depth
  insulationThickness: 1.5, // e.g. Havelock wool or XPS layer
  ceilingFramingThickness: 2.5,
  floorBuildUpThickness: 1.5,

  // Cab / front seats: approximate depth from the front wall taken up by the
  // driver + passenger seats and dash, swiveled to face the rear.
  cabDepth: 40,
  cabSeatWidth: 20,
  cabSeatDepth: 22,
  cabSeatHeight: 40,

  // Rear swing doors span the full rear opening by default.
  rearDoorWidth: 75.6,
  rearDoorHeight: 76,

  // Ram ProMaster standard passenger-side sliding door (approx.).
  sideDoorWidth: 49,
  sideDoorHeight: 62,
  sideDoorOffsetZ: 40,
  sideDoorSide: 'right',

  // Height budget for roof-mounted gear (solar, Starlink, vents, roof AC).
  roofClearance: 14,

  // Height budget below the floor for undercarriage-mounted gear (tanks, etc).
  underbodyClearance: 10,

  // Rear wheel wells — approximated from community-measured Ram ProMaster
  // 159" conversion sources (Ram doesn't publish interior wheel-well
  // dimensions): ~55.8" clear width between the arches at floor level (=>
  // ~9.9"/side intrusion off a 75.6" interior width, rounded to 10), ~17"
  // arch height, ~34" front-to-back length on the extended wheelbase.
  // Longitudinal position is the least certain of the bunch (no single
  // agreed-upon reference point in the sources) — placed with a modest gap
  // ahead of the rear doors as a starting point. Adjust all four to your own
  // tape-measure numbers before cutting anything. Front wheel wells aren't
  // modeled — they fall inside the cab zone, which is already off-limits.
  wheelWellWidth: 10,
  wheelWellHeight: 17,
  wheelWellLength: 34,
  rearWheelWellCenterZ: 126.2,
};

// A starter, standardized component catalog. Dimensions are W (across) x D
// (front-back) x H (up), in inches, at rotation 0. Users extend/edit this
// list from the Catalog panel.
function def(partial: Omit<ComponentDef, 'id' | 'standard'>): ComponentDef {
  return { id: uuid(), standard: true, ...partial };
}

export const DEFAULT_DEFS: ComponentDef[] = [
  def({ name: 'Platform Bed (Queen Short)', category: 'bed', dims: { w: 54, d: 72, h: 9 } }),
  def({ name: 'Fixed Bench/Dinette Bed', category: 'bed', dims: { w: 48, d: 24, h: 18 } }),
  def({ name: 'Swivel Cab Seat', category: 'seating', dims: { w: 22, d: 22, h: 20 } }),
  def({ name: 'Galley Kitchen Block', category: 'kitchen', dims: { w: 36, d: 24, h: 36 } }),
  def({
    name: 'Round Bar Sink (15")',
    category: 'sink',
    dims: { w: 15, d: 15, h: 6 },
    overlapGroup: 'sink-option',
  }),
  def({
    name: 'Rect. Kitchen Sink (20x16)',
    category: 'sink',
    dims: { w: 20, d: 16, h: 6 },
    overlapGroup: 'sink-option',
  }),
  def({ name: 'Bathroom Vanity Cabinet', category: 'vanity', dims: { w: 24, d: 18, h: 34 } }),
  def({ name: 'Wet Bath Shower Pan (32x32)', category: 'shower', dims: { w: 32, d: 32, h: 4 } }),
  def({ name: 'Cassette Toilet', category: 'toilet', dims: { w: 16, d: 16, h: 16 } }),
  def({ name: 'Upper Cabinet', category: 'cabinet', dims: { w: 30, d: 12, h: 14 } }),
  def({ name: 'Base Cabinet', category: 'cabinet', dims: { w: 24, d: 20, h: 30 } }),
  def({ name: '12V Compressor Fridge', category: 'appliance', dims: { w: 18, d: 18, h: 20 } }),
  def({ name: 'Diesel Heater Unit', category: 'appliance', dims: { w: 10, d: 10, h: 8 } }),
  def({ name: 'Fresh Water Tank (20gal)', category: 'water', dims: { w: 24, d: 16, h: 10 } }),
  def({ name: 'Grey Water Tank (20gal)', category: 'water', dims: { w: 24, d: 16, h: 10 } }),
  def({ name: 'Battery/Electrical Box', category: 'electrical', dims: { w: 20, d: 14, h: 10 } }),
  def({ name: 'Shore Power Inlet Panel', category: 'electrical', dims: { w: 8, d: 3, h: 8 } }),
  def({ name: 'Overhead Storage Cubby', category: 'storage', dims: { w: 36, d: 14, h: 12 } }),
  def({ name: 'Under-Bed Garage Bin', category: 'storage', dims: { w: 30, d: 20, h: 12 } }),

  // --- Power system: battery bank, inverter, and supporting electrical ---
  def({ name: 'Lithium Battery (100Ah)', category: 'electrical', dims: { w: 13, d: 7, h: 9 } }),
  def({ name: 'Inverter/Charger (2000W)', category: 'electrical', dims: { w: 16, d: 8, h: 5 } }),
  def({ name: 'DC-DC Charger', category: 'electrical', dims: { w: 6, d: 4, h: 2 } }),
  def({ name: 'Solar Charge Controller', category: 'electrical', dims: { w: 6, d: 4, h: 2 } }),
  def({ name: '12V Fuse/Breaker Panel', category: 'electrical', dims: { w: 10, d: 6, h: 3 } }),
  def({ name: 'Battery Monitor / Shunt', category: 'electrical', dims: { w: 4, d: 3, h: 2 } }),

  // --- Plumbing fixtures ---
  def({ name: 'Water Pump (Demand Pump)', category: 'plumbing', dims: { w: 6, d: 5, h: 5 } }),
  def({ name: 'Tankless Water Heater', category: 'plumbing', dims: { w: 17, d: 10, h: 10 } }),
  def({ name: 'Kitchen Faucet', category: 'plumbing', dims: { w: 2, d: 8, h: 12 } }),
  def({ name: 'Bathroom Faucet', category: 'plumbing', dims: { w: 2, d: 6, h: 10 } }),
  def({ name: 'Shower Mixer/Head', category: 'plumbing', dims: { w: 4, d: 4, h: 8 } }),
  def({ name: 'Inline Water Filter', category: 'plumbing', dims: { w: 3, d: 3, h: 10 } }),
  def({ name: 'City Water Inlet', category: 'plumbing', dims: { w: 4, d: 2, h: 4 } }),

  // --- Lighting fixtures ---
  def({ name: 'LED Puck Light', category: 'lighting', dims: { w: 3, d: 3, h: 1 } }),
  def({ name: 'LED Strip Light (36")', category: 'lighting', dims: { w: 36, d: 1, h: 0.5 } }),
  def({ name: 'Reading Light', category: 'lighting', dims: { w: 4, d: 2, h: 4 } }),
  def({ name: 'Awning/Porch Light', category: 'lighting', dims: { w: 5, d: 3, h: 5 } }),

  // --- Roof layer: its own layout plane, combined on top of the van ---
  def({
    name: 'Solar Panel (100W)',
    category: 'roof',
    mountSurface: 'roof',
    dims: { w: 41.8, d: 20.9, h: 1.4 },
  }),
  def({
    name: 'Starlink (Flat High Performance)',
    category: 'roof',
    mountSurface: 'roof',
    dims: { w: 23.9, d: 13.2, h: 2.9 },
  }),
  def({ name: 'Roof Vent/Fan (14x14)', category: 'roof', mountSurface: 'roof', dims: { w: 14, d: 14, h: 10 } }),
  def({ name: 'Roof A/C Unit', category: 'roof', mountSurface: 'roof', dims: { w: 27, d: 27, h: 14 } }),
  def({
    name: 'Roof Rack Cargo Box',
    category: 'roof',
    mountSurface: 'roof',
    dims: { w: 30, d: 48, h: 15 },
  }),

  // --- Underbody layer: its own layout plane below the floor ---
  def({
    name: 'Fresh Water Tank — Underbody (30gal)',
    category: 'water',
    mountSurface: 'underbody',
    dims: { w: 40, d: 20, h: 8 },
  }),
  def({
    name: 'Grey Water Tank — Underbody (30gal)',
    category: 'water',
    mountSurface: 'underbody',
    dims: { w: 40, d: 20, h: 8 },
  }),
  def({
    name: 'Underbody Accessory Box',
    category: 'storage',
    mountSurface: 'underbody',
    dims: { w: 24, d: 16, h: 8 },
    notes: 'Generic slot for anything else chassis-mounted — LP tank, tool box, spare parts, etc.',
  }),
];

function sym(matrix: OverlapMatrix, a: string, b: string) {
  (matrix[a] ??= {})[b] = true;
  (matrix[b] ??= {})[a] = true;
}

export function buildDefaultOverlapMatrix(): OverlapMatrix {
  const matrix: OverlapMatrix = {};
  // A sink is designed to sit within/on its vanity or kitchen counter footprint.
  sym(matrix, 'sink', 'vanity');
  sym(matrix, 'sink', 'kitchen');
  // Electrical/water infrastructure commonly tucks inside or under cabinetry/storage.
  sym(matrix, 'electrical', 'cabinet');
  sym(matrix, 'electrical', 'storage');
  sym(matrix, 'water', 'storage');
  sym(matrix, 'water', 'cabinet');
  // Plumbing fixtures mount ON/IN sinks, counters, vanities, showers, or tuck
  // into the same cabinetry/utility space as the tanks and pump they serve.
  sym(matrix, 'plumbing', 'sink');
  sym(matrix, 'plumbing', 'kitchen');
  sym(matrix, 'plumbing', 'vanity');
  sym(matrix, 'plumbing', 'shower');
  sym(matrix, 'plumbing', 'water');
  sym(matrix, 'plumbing', 'cabinet');
  sym(matrix, 'plumbing', 'storage');
  // Light fixtures mount on/in ceilings, cabinet faces, and walls above
  // whatever furniture is below them.
  sym(matrix, 'lighting', 'cabinet');
  sym(matrix, 'lighting', 'storage');
  sym(matrix, 'lighting', 'kitchen');
  sym(matrix, 'lighting', 'vanity');
  sym(matrix, 'lighting', 'bed');
  sym(matrix, 'lighting', 'seating');
  return matrix;
}
