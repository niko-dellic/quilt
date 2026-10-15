import { WebGLRenderer } from 'three';
import { createWebGPURenderer } from 'quilt-three/webgpu';
import type { ThreeRenderer } from 'quilt-three';

/** Shared by every preset and both adapters; backend selection is a demo URL option. */
export function createDemoRenderer(
  canvas: HTMLCanvasElement,
): ThreeRenderer | Promise<ThreeRenderer> {
  const params = new URLSearchParams(location.search);
  if (canvas.ownerDocument !== document && params.has('failPopout'))
    throw new Error('Simulated renderer initialization failure');
  if (params.get('renderer') === 'webgpu')
    return createWebGPURenderer(canvas, {
      alpha: true,
      antialias: true,
      forceWebGL: params.has('forceWebGL'),
      trackTimestamp: params.has('benchmark'),
    });
  return new WebGLRenderer({ canvas, alpha: true, antialias: true });
}
