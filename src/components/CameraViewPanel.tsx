import { useStore } from '../store';
import type { CameraView } from '../types';

const VIEWS: { view: CameraView; label: string }[] = [
  { view: 'iso', label: '◇ Iso' },
  { view: 'front', label: '⬒ Front' },
  { view: 'back', label: '⬓ Back' },
  { view: 'left', label: '◧ Left' },
  { view: 'right', label: '◨ Right' },
  { view: 'top', label: '⬆ Top' },
  { view: 'bottom', label: '⬇ Bottom' },
  { view: 'roof', label: '🔝 Roof plane' },
  { view: 'underbody', label: '🔩 Underbody' },
];

/** Quick-snap camera presets — jumps the orbit camera to a standard view,
 * you can still freely orbit/zoom from there. */
export default function CameraViewPanel() {
  const requestCameraView = useStore((s) => s.requestCameraView);

  return (
    <div className="section">
      <h2>Quick Views</h2>
      <div className="camera-grid">
        {VIEWS.map((v) => (
          <button key={v.view} onClick={() => requestCameraView(v.view)}>
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
