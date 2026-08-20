import { useCallback, useRef, useState } from 'react';
import TopBar from './components/TopBar';
import VanDimensionsPanel from './components/VanDimensionsPanel';
import VanFeaturesPanel from './components/VanFeaturesPanel';
import CatalogPanel from './components/CatalogPanel';
import InspectorPanel from './components/InspectorPanel';
import ViolationsPanel from './components/ViolationsPanel';
import OverlapMatrixPanel from './components/OverlapMatrixPanel';
import CameraViewPanel from './components/CameraViewPanel';
import Scene from './components/Scene';

const LEFT_COL_MIN = 260;
const LEFT_COL_MAX = 720;

export default function App() {
  const [leftWidth, setLeftWidth] = useState(300);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = { startX: e.clientX, startWidth: leftWidth };
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const next = dragRef.current.startWidth + (ev.clientX - dragRef.current.startX);
        setLeftWidth(Math.min(LEFT_COL_MAX, Math.max(LEFT_COL_MIN, next)));
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [leftWidth],
  );

  return (
    <div className="app">
      <TopBar />
      <div className="layout" style={{ gridTemplateColumns: `${leftWidth}px 5px 1fr 300px` }}>
        <div className="panel-col">
          <VanDimensionsPanel />
          <VanFeaturesPanel />
          <OverlapMatrixPanel />
          <CatalogPanel />
        </div>

        <div
          className="resize-handle"
          onMouseDown={onHandleMouseDown}
          title="Drag to resize"
        />

        <div className="canvas-wrap">
          <Scene />
          <div className="canvas-hint">
            Drag to orbit · scroll to zoom · click an item to select &amp; drag it · gizmo snaps to {0.5}"
            <br />
            Amber zone = cab (out of bounds) · dark chairs = front seats · gray panels = rear doors · blue panel =
            side slider · green plane = roof layer · brown outline = underbody layer
          </div>
        </div>

        <div className="panel-col right">
          <CameraViewPanel />
          <ViolationsPanel />
          <InspectorPanel />
        </div>
      </div>
    </div>
  );
}
