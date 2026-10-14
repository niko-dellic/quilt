import { Scene, WebGLRenderer } from 'three';
import type { PaneRenderer } from 'quilt-vanilla';
import { workspace } from './model.js';
import { createThreeSession } from 'quilt-three';
import 'quilt-vanilla/styles.css';
import { cameras, populate, viewOptions, cameraHelpers, setThreeStatus } from './three-shared.js';
const scene = new Scene();
export const session = createThreeSession({
  scene,
  window,
  onError: console.error,
  createRenderer(canvas) {
    if (canvas.ownerDocument !== document && new URLSearchParams(location.search).has('failPopout'))
      throw new Error('Simulated renderer initialization failure');
    return new WebGLRenderer({ canvas, alpha: true, antialias: true });
  },
});
const model = populate(scene, () => session.invalidate());
const disposeHelpers = cameraHelpers(scene);
export const three: PaneRenderer = (context) => {
  return session.register(context, {
    ...viewOptions(context.pane.id),
    onPointer(event, hits) {
      if (event.type === 'click')
        setThreeStatus(`${context.pane.id}: ${hits.length ? 'object selected' : 'background'}`);
    },
  });
};
Object.defineProperty(window, 'threeDemo', {
  get: () => ({ workspace, session, cameras, scene, model }),
});
window.addEventListener(
  'pagehide',
  () => {
    session.dispose();
    disposeHelpers();
    model.dispose();
  },
  { once: true },
);
