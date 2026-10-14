import type { OrbitTargetPolicy } from 'quilt-three';

// Shared by mounted viewports and settings panes, including companion windows.
let orbitTargetPolicy: OrbitTargetPolicy = 'follow';
const listeners = new Set<() => void>();
export const navigationSettings = {
  get orbitTargetPolicy() {
    return orbitTargetPolicy;
  },
  set orbitTargetPolicy(value: OrbitTargetPolicy) {
    if (value === orbitTargetPolicy) return;
    orbitTargetPolicy = value;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
