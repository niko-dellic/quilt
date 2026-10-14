import { cameraKinds } from './custom-views-layout.js';
import { renderIcon } from './icons.js';

const hiddenCameras = new Set<string>();
let customVisible = false;
const listeners = new Set<() => void>();
const syncModes = new Map<string, boolean>();
const syncListeners = new Set<() => void>();
export function cameraSyncScope(id: string): string | undefined {
  if (id === 'custom' || id.startsWith('custom-view-')) return 'custom';
  if (cameraKinds.includes(id as (typeof cameraKinds)[number])) return 'four';
}
export const cameraSync = {
  source: '',
  enabled: (id: string) => syncModes.get(cameraSyncScope(id) ?? '') ?? false,
  subscribe(listener: () => void) {
    syncListeners.add(listener);
    return () => {
      syncListeners.delete(listener);
    };
  },
};
function mountSyncToggle(element: HTMLElement, id: string) {
  const button = element.ownerDocument.createElement('button');
  button.type = 'button';
  button.className =
    id === 'custom' ? 'demo-helper-toggle' : 'demo-helper-toggle demo-camera-sync-toggle';
  button.setAttribute('aria-label', 'Sync camera positions');
  button.title = 'Sync camera positions without changing their orientation';
  const icon = renderIcon('camera-sync', element.ownerDocument)!;
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon);
  const update = () => button.setAttribute('aria-pressed', String(cameraSync.enabled(id)));
  const toggle = () => {
    cameraSync.source = id;
    syncModes.set(cameraSyncScope(id)!, !cameraSync.enabled(id));
    for (const listener of syncListeners) listener();
    for (const listener of listeners) listener();
  };
  button.addEventListener('click', toggle);
  const unsubscribe = cameraSync.subscribe(update);
  update();
  element.append(button);
  return () => {
    unsubscribe();
    button.removeEventListener('click', toggle);
    button.remove();
  };
}
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
  button.setAttribute('aria-label', custom ? 'Camera helpers' : 'Camera helper');
  const icon = renderIcon('camera-helper', element.ownerDocument)!;
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon);
  const sync = () => {
    button.disabled = cameraSync.enabled(id);
    button.title = button.disabled
      ? 'Camera helpers are disabled while camera positions are synchronized'
      : custom
        ? 'Show camera helpers in all viewports'
        : 'Show this camera in the other viewports';
    button.setAttribute(
      'aria-pressed',
      String(!button.disabled && (custom ? customVisible : !hiddenCameras.has(id))),
    );
  };
  const toggle = () => {
    if (cameraSync.enabled(id)) return;
    if (custom) customVisible = !customVisible;
    else if (hiddenCameras.has(id)) hiddenCameras.delete(id);
    else hiddenCameras.add(id);
    for (const listener of listeners) listener();
  };
  button.addEventListener('click', toggle);
  const unsubscribe = helperDisplay.subscribe(sync);
  sync();
  element.append(button);
  const disposeSync = mountSyncToggle(element, id);
  return () => {
    disposeSync();
    unsubscribe();
    button.removeEventListener('click', toggle);
    button.remove();
  };
}
