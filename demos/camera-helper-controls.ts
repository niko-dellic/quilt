import { cameraKinds } from './custom-views-layout.js';

const hiddenCameras = new Set<string>();
let customVisible = false;
const listeners = new Set<() => void>();
export const helperDisplay = {
  cameraVisible: (id: string) => !hiddenCameras.has(id),
  customVisible: () => customVisible,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Shared DOM control for both adapters; state outlives pane mounts and popouts. */
export function mountHelperToggle(element: HTMLElement, id: string) {
  const custom = id === 'custom';
  if (!custom && !cameraKinds.includes(id as (typeof cameraKinds)[number])) return () => {};
  const button = element.ownerDocument.createElement('button');
  button.type = 'button';
  button.className = custom ? 'demo-helper-toggle' : 'demo-helper-toggle demo-camera-helper-toggle';
  button.textContent = custom ? 'Camera helpers' : 'Camera helper';
  button.title = custom
    ? 'Show camera helpers in all viewports'
    : 'Show this camera in the other viewports';
  const sync = () => {
    button.setAttribute('aria-pressed', String(custom ? customVisible : !hiddenCameras.has(id)));
  };
  const toggle = () => {
    if (custom) customVisible = !customVisible;
    else if (hiddenCameras.has(id)) hiddenCameras.delete(id);
    else hiddenCameras.add(id);
    for (const listener of listeners) listener();
  };
  button.addEventListener('click', toggle);
  const unsubscribe = helperDisplay.subscribe(sync);
  sync();
  element.append(button);
  return () => {
    unsubscribe();
    button.removeEventListener('click', toggle);
    button.remove();
  };
}
