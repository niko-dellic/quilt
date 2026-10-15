import { WebGPURenderer } from 'three/webgpu';

type RendererParameters = NonNullable<ConstructorParameters<typeof WebGPURenderer>[0]>;
export interface WebGPUOptions extends Omit<RendererParameters, 'canvas' | 'device'> {
  /** Use Three.js's WebGL backend when no native adapter is available. Defaults to true. */
  fallback?: boolean;
}
/** Creates an initialized renderer and owns its device in the canvas's document.
 * Use as ThreeSession's createRenderer factory, including with the React provider.
 * Native devices must come from the companion's navigator, not its opener.
 */
export async function createWebGPURenderer(
  canvas: HTMLCanvasElement,
  options: WebGPUOptions = {},
): Promise<WebGPURenderer> {
  const { fallback = true, ...parameters } = options;
  const gpu = canvas.ownerDocument.defaultView?.navigator.gpu;
  const adapter = parameters.forceWebGL
    ? null
    : await gpu?.requestAdapter({
        powerPreference: parameters.powerPreference ?? 'high-performance',
      });
  if (!adapter) {
    if (!fallback && !parameters.forceWebGL)
      throw new Error('No WebGPU adapter is available in this document');
    const renderer = new WebGPURenderer({ ...parameters, canvas, forceWebGL: true });
    await renderer.init();
    return renderer;
  }
  const device = await adapter.requestDevice({
    requiredFeatures: [...adapter.features] as GPUFeatureName[],
  });
  let renderer: WebGPURenderer;
  try {
    renderer = new WebGPURenderer({ ...parameters, canvas, device });
  } catch (error) {
    device.destroy();
    throw error;
  }
  const dispose = renderer.dispose.bind(renderer);
  let disposal: Promise<void> | undefined;
  renderer.dispose = () =>
    (disposal ??= (async () => {
      try {
        if (renderer.hasInitialized()) await dispose();
      } finally {
        device.destroy();
      }
    })());
  try {
    await renderer.init();
    if (!fallback && !('isWebGPUBackend' in renderer.backend && renderer.backend.isWebGPUBackend))
      throw new Error('Native WebGPU initialization fell back to WebGL');
    return renderer;
  } catch (error) {
    await renderer.dispose();
    throw error;
  }
}
