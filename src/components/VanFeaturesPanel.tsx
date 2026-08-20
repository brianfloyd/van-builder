import { useState } from 'react';
import { useStore } from '../store';
import type { VanShell } from '../types';

export default function VanFeaturesPanel() {
  const shell = useStore((s) => s.shell);
  const setShell = useStore((s) => s.setShell);
  const doorsOpen = useStore((s) => s.doorsOpen);
  const toggleDoor = useStore((s) => s.toggleDoor);
  const [open, setOpen] = useState(false);

  function num(key: keyof VanShell) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setShell({ [key]: parseFloat(e.target.value) || 0 } as Partial<VanShell>);
  }

  return (
    <div className="section">
      <h2 style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        Cab, Doors &amp; Layers {open ? '▾' : '▸'}
      </h2>

      <div className="hint" style={{ marginTop: 0 }}>
        Open doors to check build clearance
      </div>
      <div className="button-row" style={{ marginBottom: 10 }}>
        <button onClick={() => toggleDoor('rear')}>
          {doorsOpen.rear ? '🚪 Close rear doors' : '🚪 Open rear doors'}
        </button>
        <button onClick={() => toggleDoor('side')}>
          {doorsOpen.side ? '🚪 Close side door' : '🚪 Open side door'}
        </button>
      </div>

      {!open ? (
        <div className="hint" style={{ marginBottom: 0 }}>
          Rear doors, side slider, the front cab/seat exclusion zone, and clearance for the roof + underbody layout
          planes.
        </div>
      ) : (
        <>
          <div className="hint" style={{ marginTop: 0 }}>
            Cab area (driver/passenger seats, swiveled to face the rear). Nothing may be built inside this zone.
          </div>
          <div className="field-row">
            <label>Cab depth from front (in)</label>
            <input type="number" value={shell.cabDepth} onChange={num('cabDepth')} />
          </div>
          <div className="field-row">
            <label>Seat width (in)</label>
            <input type="number" value={shell.cabSeatWidth} onChange={num('cabSeatWidth')} />
          </div>
          <div className="field-row">
            <label>Seat depth (in)</label>
            <input type="number" value={shell.cabSeatDepth} onChange={num('cabSeatDepth')} />
          </div>
          <div className="field-row">
            <label>Seat height (in)</label>
            <input type="number" value={shell.cabSeatHeight} onChange={num('cabSeatHeight')} />
          </div>

          <div className="hint">Rear swing doors (shown propped open)</div>
          <div className="field-row">
            <label>Rear door width (in)</label>
            <input type="number" value={shell.rearDoorWidth} onChange={num('rearDoorWidth')} />
          </div>
          <div className="field-row">
            <label>Rear door height (in)</label>
            <input type="number" value={shell.rearDoorHeight} onChange={num('rearDoorHeight')} />
          </div>

          <div className="hint">Side sliding door — dimensions vary by van, adjust as needed</div>
          <div className="field-row">
            <label>Side door width (in)</label>
            <input type="number" value={shell.sideDoorWidth} onChange={num('sideDoorWidth')} />
          </div>
          <div className="field-row">
            <label>Side door height (in)</label>
            <input type="number" value={shell.sideDoorHeight} onChange={num('sideDoorHeight')} />
          </div>
          <div className="field-row">
            <label>Offset from front (in)</label>
            <input type="number" value={shell.sideDoorOffsetZ} onChange={num('sideDoorOffsetZ')} />
          </div>
          <div className="field-row">
            <label>Side</label>
            <select
              value={shell.sideDoorSide}
              onChange={(e) => setShell({ sideDoorSide: e.target.value as 'left' | 'right' })}
            >
              <option value="left">Left (driver)</option>
              <option value="right">Right (passenger)</option>
            </select>
          </div>

          <div className="hint">Roof layer — solar, Starlink, vents, roof A/C (its own layout plane)</div>
          <div className="field-row">
            <label>Roof equipment clearance (in)</label>
            <input type="number" value={shell.roofClearance} onChange={num('roofClearance')} />
          </div>

          <div className="hint">
            Underbody layer — tanks and other chassis-mounted gear (also auto-clears the front cab depth, a rough
            stand-in for the engine/transmission area)
          </div>
          <div className="field-row">
            <label>Underbody clearance (in)</label>
            <input type="number" value={shell.underbodyClearance} onChange={num('underbodyClearance')} />
          </div>
        </>
      )}
    </div>
  );
}
