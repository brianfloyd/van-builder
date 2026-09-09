import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import { initDevSync } from './devSync';
import { useStore } from './store';

// Viewer mode = phone/tablet walk-around: orbit the van, toggle labels,
// nothing else. Auto-on for touch-first devices on a small screen; force it
// anywhere with ?viewer, or force the full editor on a phone with ?full.
const params = new URLSearchParams(window.location.search);
const coarseSmall = window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 900;
const viewerMode = params.has('viewer') || (coarseSmall && !params.has('full'));
useStore.getState().setViewerMode(viewerMode);
// ?catalog opens the full-screen Catalog Sheet (spreadsheet view) straight
// away — handy for a second browser tab / second monitor next to the 3D view.
if (params.has('catalog') && !viewerMode) useStore.getState().setCatalogSheetOpen(true);

initDevSync({ readOnly: viewerMode });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
