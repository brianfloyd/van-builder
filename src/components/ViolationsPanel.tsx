import { useStore } from '../store';

const ICONS: Record<string, string> = {
  collision: '⚠',
  'out-of-bounds': '⛔',
  obstacle: '🚫',
};

export default function ViolationsPanel() {
  const violations = useStore((s) => s.violations());
  const selectInstance = useStore((s) => s.selectInstance);
  const resolveInstance = useStore((s) => s.resolveInstance);

  return (
    <div className="section">
      <h2>Conflicts</h2>
      {violations.length === 0 ? (
        <div className="empty-state">No overlaps, obstacles, or out-of-bounds items. ✓</div>
      ) : (
        violations.map((v, idx) => (
          <div key={idx} className={`violation-item ${v.type}`}>
            <button
              className="fix-btn icon-btn"
              title="Snap the first affected item to the nearest conflict-free spot"
              onClick={(e) => {
                e.stopPropagation();
                const ok = resolveInstance(v.instanceIds[0]);
                if (!ok) alert('No conflict-free spot found nearby — try moving it manually.');
              }}
            >
              Fix
            </button>
            <span onClick={() => selectInstance(v.instanceIds[0])} style={{ cursor: 'pointer' }} title="Click to select">
              {ICONS[v.type] ?? '⚠'} {v.message}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
