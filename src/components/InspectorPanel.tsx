import { useStore, GRID_SNAP } from '../store';
import { CATEGORY_COLORS } from '../types';

export default function InspectorPanel() {
  const instances = useStore((s) => s.instances);
  const defsById = useStore((s) => s.defsById());
  const selectedId = useStore((s) => s.selectedInstanceId);
  const selectInstance = useStore((s) => s.selectInstance);
  const updateInstance = useStore((s) => s.updateInstance);
  const moveInstance = useStore((s) => s.moveInstance);
  const removeInstance = useStore((s) => s.removeInstance);
  const duplicateInstance = useStore((s) => s.duplicateInstance);
  const resolveInstance = useStore((s) => s.resolveInstance);
  const violations = useStore((s) => s.violations());
  const clearances = useStore((s) => (selectedId ? s.clearances(selectedId) : null));
  const showClearances = useStore((s) => s.showClearances);
  const toggleClearances = useStore((s) => s.toggleClearances);

  const selected = instances.find((i) => i.id === selectedId) ?? null;
  const def = selected ? defsById[selected.defId] : null;
  const selectedViolations = selected ? violations.filter((v) => v.instanceIds.includes(selected.id)) : [];

  function handleResolve() {
    if (!selected) return;
    const ok = resolveInstance(selected.id);
    if (!ok) alert('No conflict-free spot found nearby — try moving it manually or freeing up space first.');
  }

  return (
    <>
      <div className="section">
        <h2>Selected Item</h2>
        {!selected || !def ? (
          <div className="empty-state">Click an item in the 3D view, or add one from the catalog.</div>
        ) : (
          <>
            <div className="field-row">
              <label>Type</label>
              <span style={{ fontSize: 12.5 }}>{def.name}</span>
            </div>
            <div className="field-row">
              <label>Label</label>
              <input
                type="text"
                placeholder={def.name}
                value={selected.label ?? ''}
                onChange={(e) => updateInstance(selected.id, { label: e.target.value || undefined })}
              />
            </div>

            <div className="hint">Position (in) — X: width, Y: height off floor, Z: length</div>
            <div className="field-row">
              <label>X</label>
              <input
                type="number"
                value={selected.pos.x}
                onChange={(e) =>
                  updateInstance(selected.id, { pos: { ...selected.pos, x: parseFloat(e.target.value) || 0 } })
                }
              />
            </div>
            <div className="field-row">
              <label>Y</label>
              <input
                type="number"
                value={selected.pos.y}
                onChange={(e) =>
                  updateInstance(selected.id, { pos: { ...selected.pos, y: parseFloat(e.target.value) || 0 } })
                }
              />
            </div>
            <div className="field-row">
              <label>Z</label>
              <input
                type="number"
                value={selected.pos.z}
                onChange={(e) =>
                  updateInstance(selected.id, { pos: { ...selected.pos, z: parseFloat(e.target.value) || 0 } })
                }
              />
            </div>

            <div className="hint">Move (± {GRID_SNAP}") — floor plane, and height</div>
            <div className="dpad-row">
              <div className="dpad">
                <button
                  className="dpad-btn dpad-fwd"
                  title="Forward"
                  onClick={() => moveInstance(selected.id, { z: -GRID_SNAP })}
                >
                  ▲
                </button>
                <button
                  className="dpad-btn dpad-left"
                  title="Left"
                  onClick={() => moveInstance(selected.id, { x: -GRID_SNAP })}
                >
                  ◀
                </button>
                <button
                  className="dpad-btn dpad-right"
                  title="Right"
                  onClick={() => moveInstance(selected.id, { x: GRID_SNAP })}
                >
                  ▶
                </button>
                <button
                  className="dpad-btn dpad-back"
                  title="Back"
                  onClick={() => moveInstance(selected.id, { z: GRID_SNAP })}
                >
                  ▼
                </button>
              </div>
              <div className="vpad">
                <button title="Up" onClick={() => moveInstance(selected.id, { y: GRID_SNAP })}>
                  ⤒ Up
                </button>
                <button title="Down" onClick={() => moveInstance(selected.id, { y: -GRID_SNAP })}>
                  ⤓ Down
                </button>
              </div>
            </div>

            {selectedViolations.length > 0 && (
              <div className="hint" style={{ color: '#ffb703' }}>
                ⚠ {selectedViolations.length} conflict{selectedViolations.length === 1 ? '' : 's'} on this item
              </div>
            )}
            <button
              className={selectedViolations.length > 0 ? 'danger' : ''}
              style={{ width: '100%', marginBottom: 8 }}
              onClick={handleResolve}
            >
              📍 Snap to nearest safe spot
            </button>

            <div className="hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Clearance to nearest obstacle (in)</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={showClearances} onChange={toggleClearances} />
                show in 3D
              </label>
            </div>
            {clearances && (
              <div className="clearance-grid">
                <div className="clearance-cell" style={{ gridArea: 'fwd' }}>
                  <span className="clearance-label">Fwd</span>
                  <span className="clearance-value">{clearances.forward.toFixed(1)}"</span>
                </div>
                <div className="clearance-cell" style={{ gridArea: 'left' }}>
                  <span className="clearance-label">Left</span>
                  <span className="clearance-value">{clearances.left.toFixed(1)}"</span>
                </div>
                <div className="clearance-cell" style={{ gridArea: 'right' }}>
                  <span className="clearance-label">Right</span>
                  <span className="clearance-value">{clearances.right.toFixed(1)}"</span>
                </div>
                <div className="clearance-cell" style={{ gridArea: 'back' }}>
                  <span className="clearance-label">Back</span>
                  <span className="clearance-value">{clearances.back.toFixed(1)}"</span>
                </div>
                <div className="clearance-cell" style={{ gridArea: 'up' }}>
                  <span className="clearance-label">Up</span>
                  <span className="clearance-value">{clearances.up.toFixed(1)}"</span>
                </div>
                <div className="clearance-cell" style={{ gridArea: 'down' }}>
                  <span className="clearance-label">Down</span>
                  <span className="clearance-value">{clearances.down.toFixed(1)}"</span>
                </div>
              </div>
            )}

            <div className="field-row" style={{ marginTop: 10 }}>
              <label>Rotation</label>
              <div className="button-row">
                <button
                  onClick={() =>
                    updateInstance(selected.id, { rotationY: (((selected.rotationY - 90) % 360) + 360) % 360 as any })
                  }
                >
                  ⟲ 90°
                </button>
                <button
                  onClick={() => updateInstance(selected.id, { rotationY: ((selected.rotationY + 90) % 360) as any })}
                >
                  ⟳ 90°
                </button>
              </div>
            </div>

            <div className="field-row">
              <label>Locked</label>
              <input
                type="checkbox"
                checked={!!selected.locked}
                onChange={(e) => updateInstance(selected.id, { locked: e.target.checked })}
              />
            </div>

            <div className="button-row" style={{ marginTop: 8 }}>
              <button onClick={() => duplicateInstance(selected.id)}>Duplicate</button>
              <button className="danger" onClick={() => removeInstance(selected.id)}>
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      <div className="section">
        <h2>Placed Items ({instances.length})</h2>
        <div className="instance-list">
          {instances.length === 0 && <div className="empty-state">Nothing placed yet.</div>}
          {instances.map((inst) => {
            const d = defsById[inst.defId];
            if (!d) return null;
            return (
              <div
                key={inst.id}
                className={`catalog-item ${inst.id === selectedId ? 'selected' : ''}`}
                onClick={() => selectInstance(inst.id)}
              >
                <span className="swatch" style={{ background: d.color ?? CATEGORY_COLORS[d.category] }} />
                <span className="name">{inst.label || d.name}</span>
                {inst.locked && <span title="Locked">🔒</span>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
