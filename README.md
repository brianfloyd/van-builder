# Van Builder

A parametric 3D adventure-van layout tool. Set your van's interior
dimensions, build out a catalog of standardized components across three
layout planes (interior, roof, undercarriage), and drag them into place with
automatic conflict detection.

## Running it

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

## How it's modeled

**Van shell → buildable envelope.** You enter the van's raw interior
dimensions (length/width/height) plus wall scaffold/framing thickness,
insulation thickness, ceiling framing allowance, and floor build-up. The app
subtracts those from the raw shell to get the actual **buildable envelope** —
the space components can occupy. Change any of those numbers (e.g. thicker
insulation) and the envelope — and every placement constraint — recomputes
live. See [src/geometry.ts](src/geometry.ts) `computeEnvelope`.

**Three layout planes, one combined scene.** Most components mount on the
interior **floor**. Roof-mounted gear (solar, Starlink, vents, roof A/C) and
undercarriage gear (water tanks, other chassis-mounted equipment) each get
their **own** layout plane with independent collision checking — a roof
solar panel never "collides" with a floor bed — but all three render
combined in the same 3D scene, stacked in their real physical relationship.
Set a component's plane via **Mounts on** in the catalog editor. See
`computeEnvelope` / `computeRoofEnvelope` / `computeUnderbodyEnvelope` /
`envelopeFor` in [src/geometry.ts](src/geometry.ts).
- The **undercarriage** plane is deliberately simple: a shallow box under the
  floor that also auto-clears the front `cabDepth`, a rough stand-in for the
  engine/transmission area. Exact drivetrain geometry isn't modeled.

**Cab / front seats — a hard exclusion zone.** The front `cabDepth` inches of
the van (driver + passenger area) is always off-limits to placed components,
regardless of the envelope math — nothing can be built there. Two
approximate captain's chairs are drawn swiveled to face the rear, positioned
against the *rear* edge of that reserved zone (bordering the living area),
leaving the front open for the windshield/dash/steering wheel, which aren't
modeled. Configurable in the **Cab, Doors & Layers** panel.

**Rear doors & side slider.** Reference geometry only — doesn't constrain
the envelope. Rear doors are hinged swing panels; the side door is a
sliding-door marker (dimensions/position configurable, since they vary van
to van). Use the **Open/Close** buttons in **Cab, Doors & Layers** to check
build clearance against them.

**Component catalog.** A starter set of standardized components ships in
[src/defaultData.ts](src/defaultData.ts) — bed, dinette, galley, sinks,
vanity, shower, toilet, cabinets, storage, a power system (batteries,
inverter, charge controller, fuse panel), plumbing fixtures (pump, tankless
heater, faucets, filter, inlet), lighting, roof gear, and undercarriage
tanks/accessory box. Add, rename, resize, recolor, or delete types from the
**Component Catalog** panel — this is meant to grow into your own
standardized parts list over time.

**Placing & moving.** Click "+" on a catalog entry to drop an instance into
the van. Select it (click in the 3D view or in "Placed Items") and either:
- drag its on-screen gizmo (snaps to 0.5"),
- type exact X/Y/Z inches in the Inspector,
- use the directional pad (floor plane) and Up/Down buttons, or
- rotate it 90° at a time.

X/Z track the item's footprint *center* (so rotation doesn't shift it), Y
tracks its *base* height off its plane's floor (so you can mount something
on a shelf at, say, Y=30, or a tank hanging below the floor at Y=-6).

**Quick camera views.** The Quick Views panel snaps the camera to Iso,
Front, Back, Left, Right, Top, Bottom, a framed Roof-plane view, or a framed
Underbody view — you can still freely orbit/zoom from wherever it lands.

**"Snap to nearest safe spot."** If an item is out of bounds or colliding,
click this in the Inspector (or "Fix" next to any conflict in the Conflicts
panel) to move it — same rotation — to the closest position that resolves
every conflict, searching outward in a ring pattern on its own plane first.
See `findNearestValidPosition` in [src/geometry.ts](src/geometry.ts).

**Overlap rules — "designed to overlap" vs. real collisions.** Every pair of
placed items *on the same layout plane* is checked with AABB (rotation-aware)
intersection. An overlap is only flagged as a conflict if it's *not*
explicitly allowed:

1. **Category matrix** (Overlap Rules panel): e.g. `sink ↔ vanity`, `sink ↔
   kitchen`, `plumbing ↔ sink/vanity/shower/water`, `lighting ↔
   cabinet/storage/bed` are allowed by default, since those things are
   designed to sit in/on each other. `shower ↔ bed` is not, so that always
   flags. Toggle any category pair on/off yourself.
2. **Overlap group** (per component, in the catalog editor): components
   sharing a group string (e.g. `sink-option`) are always allowed to overlap
   each other — for comparing alternate options in the same slot, like two
   different sink sizes on the same vanity cut-out.
3. **Per-instance whitelist** (`overlapWhitelist` in the data model) for
   one-off exceptions, settable via import/export JSON today.

Anything outside its plane's envelope is flagged too, and anything on the
floor plane overlapping the cab zone is flagged as an obstacle conflict.
All three show up live in the **Conflicts** panel and highlight red in the
3D view; click a conflict (or its "Fix" button) to jump to / resolve the
offending item.

**Persistence.** The project (shell + catalog + placed items + overlap
rules) autosaves to `localStorage`. Door open/closed state and the current
camera-view request are transient UI state, not saved. Use **Export JSON** /
**Import JSON** in the top bar to save named layouts to disk or share them.

## Project structure

```
src/
  types.ts          domain model (VanShell, ComponentDef, PlacedInstance, MountSurface, ...)
  geometry.ts        envelope math (floor/roof/underbody), AABB collision, rotation,
                     snapping, nearest-safe-spot resolver
  defaultData.ts     starter van shell + component catalog + overlap matrix
  store.ts           zustand store: single source of truth + localStorage persistence
  components/
    Scene.tsx              R3F canvas, camera, lighting, CameraRig (quick-view snapping)
    VanShellMesh.tsx        shell wireframe + envelope wireframe + floor grid
    VanFeaturesMesh.tsx     cab zone + seats + rear/side doors (open/close aware)
    RoofPlaneMesh.tsx       roof layout plane wireframe + grid
    UnderbodyPlaneMesh.tsx  undercarriage layout plane wireframe
    PlacedItemMesh.tsx      one placed component + its drag gizmo
    TopBar.tsx              export/import/reset
    VanDimensionsPanel.tsx
    VanFeaturesPanel.tsx    cab/door/roof/underbody config + door open/close buttons
    CameraViewPanel.tsx     quick-view buttons
    OverlapMatrixPanel.tsx
    CatalogPanel.tsx        add/edit/delete component types, incl. mount surface
    InspectorPanel.tsx      selected item's position/rotation/lock + snap-to-safe + placed list
    ViolationsPanel.tsx
```

## Where to go next

Ideas worth adding as this grows:
- Wheel-well cutouts and other shell obstructions (currently the floor
  envelope is a clean box).
- Weight/CG tracking per component for axle-load estimates.
- A top-down 2D floor-plan view alongside the 3D one.
- Multiple saved layouts/variants side by side.
- Real engine/drivetrain geometry for the undercarriage plane, if it ever
  matters beyond the current cabDepth approximation.
