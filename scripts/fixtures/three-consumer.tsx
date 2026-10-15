import { createWebGPURenderer } from 'quilt-three/webgpu';
import { Scene } from 'three';
import { ThreeSession, ThreeView as View, CameraHelpers, NavigationControls } from 'quilt-three';
import {
  CameraHelpers as ReactCameraHelpers,
  SharedScene,
  ThreeSessionProvider,
  ThreeView,
  useThreeSession,
} from 'quilt-three-react';
export function plain(window: Window) {
  const session = new ThreeSession({ scene: new Scene(), window });
  const helpers = new CameraHelpers(session);
  helpers.setVisible(false);
  const views: readonly View[] = session.getViews();
  return { session, helpers, views };
}
export function App() {
  return (
    <ThreeSessionProvider>
      <ReactCameraHelpers visible={false} />
      <SharedScene>
        <mesh>
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </SharedScene>
    </ThreeSessionProvider>
  );
}
export { ThreeView, useThreeSession };

export { NavigationControls };
export function gpu(window: Window) {
  return new ThreeSession({
    scene: new Scene(),
    window,
    createRenderer: (canvas) => createWebGPURenderer(canvas, { fallback: false }),
  });
}
export function GPUProvider() {
  return (
    <ThreeSessionProvider options={{ createRenderer: createWebGPURenderer }}>
      <SharedScene>
        <mesh />
      </SharedScene>
    </ThreeSessionProvider>
  );
}
