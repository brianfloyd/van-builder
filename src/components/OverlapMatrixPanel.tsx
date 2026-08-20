import { useState } from 'react';
import { useStore } from '../store';
import { CATEGORIES } from '../types';

/** Editable category x category "designed to overlap" rule matrix, e.g. a
 * sink is expected to sit within its vanity's footprint, but a shower should
 * never overlap a bed. */
export default function OverlapMatrixPanel() {
  const overlapMatrix = useStore((s) => s.overlapMatrix);
  const setOverlapAllowed = useStore((s) => s.setOverlapAllowed);
  const [open, setOpen] = useState(false);

  return (
    <div className="section">
      <h2 style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        Overlap Rules {open ? '▾' : '▸'}
      </h2>
      {!open ? (
        <div className="hint" style={{ marginBottom: 0 }}>
          Which categories are allowed to intentionally overlap (e.g. sink ↔ vanity).
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="matrix-table">
            <thead>
              <tr>
                <th></th>
                {CATEGORIES.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((rowCat) => (
                <tr key={rowCat}>
                  <td className="rowlabel">{rowCat}</td>
                  {CATEGORIES.map((colCat) => (
                    <td key={colCat}>
                      <input
                        type="checkbox"
                        checked={!!overlapMatrix[rowCat]?.[colCat]}
                        onChange={(e) => setOverlapAllowed(rowCat, colCat, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="hint">
            Checked = these two categories are allowed to overlap by design. Everything unchecked is treated as a
            real collision. Individual components can also be linked via "overlap group" in the catalog for
            alternates (e.g. two sink options for the same slot).
          </div>
        </div>
      )}
    </div>
  );
}
