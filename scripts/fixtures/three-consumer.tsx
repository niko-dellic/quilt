import { Scene } from 'three';
import { createThreeSession } from 'quilt-three';
import { SharedScene, ThreeSessionProvider, ThreeView, useThreeSession } from 'quilt-three/react';
export function plain(window: Window) {
  return createThreeSession({ scene: new Scene(), window });
}
export function App() {
  return (
    <ThreeSessionProvider>
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
