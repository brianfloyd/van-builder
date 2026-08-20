import TopBar from './components/TopBar';
import VanDimensionsPanel from './components/VanDimensionsPanel';
import VanFeaturesPanel from './components/VanFeaturesPanel';
import CatalogPanel from './components/CatalogPanel';
import InspectorPanel from './components/InspectorPanel';
import ViolationsPanel from './components/ViolationsPanel';
import OverlapMatrixPanel from './components/OverlapMatrixPanel';
import CameraViewPanel from './components/CameraViewPanel';
import Scene from './components/Scene';

export default function App() {
  return (
    <div className="app">
      <TopBar />
      <div className="layout">
        <div className="panel-col">
          <VanDimensionsPanel />
          <VanFeaturesPanel />
          <OverlapMatrixPanel />
          <CatalogPanel />
        </div>

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
