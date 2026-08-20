import { useState } from 'react';
import { useStore } from '../store';
import { CATEGORIES, CATEGORY_COLORS } from '../types';
import type { Category, MountSurface } from '../types';

export default function CatalogPanel() {
  const defs = useStore((s) => s.defs);
  const addDef = useStore((s) => s.addDef);
  const updateDef = useStore((s) => s.updateDef);
  const removeDef = useStore((s) => s.removeDef);
  const addInstance = useStore((s) => s.addInstance);
  const instances = useStore((s) => s.instances);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'other' as Category,
    mountSurface: 'floor' as MountSurface,
    w: 12,
    d: 12,
    h: 12,
    overlapGroup: '',
  });

  function resetForm() {
    setForm({ name: '', category: 'other', mountSurface: 'floor', w: 12, d: 12, h: 12, overlapGroup: '' });
  }

  function handleCreate() {
    if (!form.name.trim()) return;
    addDef({
      name: form.name.trim(),
      category: form.category,
      mountSurface: form.mountSurface,
      dims: { w: form.w, d: form.d, h: form.h },
      overlapGroup: form.overlapGroup.trim() || undefined,
    });
    resetForm();
    setShowNewForm(false);
  }

  return (
    <div className="section">
      <h2>Component Catalog</h2>
      <div className="catalog-list">
        {defs.map((d) => {
          const usageCount = instances.filter((i) => i.defId === d.id).length;
          const editing = editingId === d.id;
          return (
            <div key={d.id}>
              <div className={`catalog-item ${editing ? 'selected' : ''}`}>
                <span className="swatch" style={{ background: d.color ?? CATEGORY_COLORS[d.category] }} />
                <span className="name" title={d.name}>
                  {d.name}
                </span>
                {d.mountSurface === 'roof' && <span className="roof-badge">roof</span>}
                {d.mountSurface === 'underbody' && <span className="roof-badge underbody-badge">underbody</span>}
                <span className="dims">
                  {d.dims.w}×{d.dims.d}×{d.dims.h}"
                </span>
                <button className="icon-btn" title="Add to van" onClick={() => addInstance(d.id)}>
                  ＋
                </button>
                <button className="icon-btn" title="Edit" onClick={() => setEditingId(editing ? null : d.id)}>
                  ✎
                </button>
                <button
                  className="icon-btn"
                  title={usageCount > 0 ? `Delete (${usageCount} placed will be removed)` : 'Delete'}
                  onClick={() => {
                    const msg =
                      usageCount > 0
                        ? `Delete "${d.name}"? This will also remove ${usageCount} placed instance(s) from the van.`
                        : `Delete "${d.name}"?`;
                    if (confirm(msg)) removeDef(d.id);
                  }}
                >
                  ✕
                </button>
              </div>
              {editing && (
                <div className="add-form" style={{ padding: '6px 8px 10px 8px' }}>
                  <div className="field-row">
                    <label>Name</label>
                    <input
                      type="text"
                      value={d.name}
                      onChange={(e) => updateDef(d.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="field-row">
                    <label>Category</label>
                    <select
                      value={d.category}
                      onChange={(e) => updateDef(d.id, { category: e.target.value as Category })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-row">
                    <label>W × D × H (in)</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        type="number"
                        style={{ width: 46 }}
                        value={d.dims.w}
                        onChange={(e) => updateDef(d.id, { dims: { ...d.dims, w: parseFloat(e.target.value) || 0 } })}
                      />
                      <input
                        type="number"
                        style={{ width: 46 }}
                        value={d.dims.d}
                        onChange={(e) => updateDef(d.id, { dims: { ...d.dims, d: parseFloat(e.target.value) || 0 } })}
                      />
                      <input
                        type="number"
                        style={{ width: 46 }}
                        value={d.dims.h}
                        onChange={(e) => updateDef(d.id, { dims: { ...d.dims, h: parseFloat(e.target.value) || 0 } })}
                      />
                    </div>
                  </div>
                  <div className="field-row">
                    <label>Mounts on</label>
                    <select
                      value={d.mountSurface ?? 'floor'}
                      onChange={(e) => updateDef(d.id, { mountSurface: e.target.value as MountSurface })}
                    >
                      <option value="floor">Floor / interior</option>
                      <option value="roof">Roof (own layout plane)</option>
                      <option value="underbody">Underbody (own layout plane)</option>
                    </select>
                  </div>
                  <div className="field-row">
                    <label>Color</label>
                    <input
                      type="color"
                      value={d.color ?? CATEGORY_COLORS[d.category]}
                      onChange={(e) => updateDef(d.id, { color: e.target.value })}
                    />
                  </div>
                  <div className="field-row">
                    <label>Overlap group</label>
                    <input
                      type="text"
                      placeholder="e.g. sink-option"
                      value={d.overlapGroup ?? ''}
                      onChange={(e) => updateDef(d.id, { overlapGroup: e.target.value || undefined })}
                    />
                  </div>
                  <div className="hint">
                    Components sharing an overlap group (e.g. alternate sink options) are always allowed to overlap
                    each other, regardless of category rules.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showNewForm ? (
        <div className="add-form" style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div className="field-row">
            <label>Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field-row">
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <label>W × D × H (in)</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="number"
                style={{ width: 46 }}
                value={form.w}
                onChange={(e) => setForm({ ...form, w: parseFloat(e.target.value) || 0 })}
              />
              <input
                type="number"
                style={{ width: 46 }}
                value={form.d}
                onChange={(e) => setForm({ ...form, d: parseFloat(e.target.value) || 0 })}
              />
              <input
                type="number"
                style={{ width: 46 }}
                value={form.h}
                onChange={(e) => setForm({ ...form, h: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="field-row">
            <label>Mounts on</label>
            <select
              value={form.mountSurface}
              onChange={(e) => setForm({ ...form, mountSurface: e.target.value as MountSurface })}
            >
              <option value="floor">Floor / interior</option>
              <option value="roof">Roof (own layout plane)</option>
              <option value="underbody">Underbody (own layout plane)</option>
            </select>
          </div>
          <div className="field-row">
            <label>Overlap group</label>
            <input
              type="text"
              placeholder="optional"
              value={form.overlapGroup}
              onChange={(e) => setForm({ ...form, overlapGroup: e.target.value })}
            />
          </div>
          <div className="button-row">
            <button className="primary" onClick={handleCreate}>
              Create
            </button>
            <button
              onClick={() => {
                setShowNewForm(false);
                resetForm();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button style={{ marginTop: 10, width: '100%' }} onClick={() => setShowNewForm(true)}>
          + New component type
        </button>
      )}
    </div>
  );
}
