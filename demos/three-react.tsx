import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useFrame, useThree } from '@react-three/fiber';
import type { PaneProps } from 'quilt-react';
import { SharedScene, ThreeSessionProvider, ThreeView } from 'quilt-three/react';
import type { ThreeSession } from 'quilt-three';
import { workspace } from './model.js';
import { cameras, populate, viewOptions, cameraHelpers, setThreeStatus } from './three-shared.js';
let session: ThreeSession;

const counters = { mounts: 0, unmounts: 0, ticks: 0, clicks: 0 };
function SceneContent() {
  const scene = useThree((state) => state.scene);
  const model = useMemo(() => populate(scene, () => session.invalidate()), [scene]);
  useEffect(() => {
    counters.mounts++;
    return () => {
      counters.unmounts++;
      model.dispose();
    };
  }, [model]);
  useFrame(() => {
    counters.ticks++;
  });
  return (
    <primitive
      object={model.group}
      dispose={null}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        counters.clicks++;
        setThreeStatus('R3F object selected');
      }}
    />
  );
}
export function ThreePane(props: PaneProps) {
  return <ThreeView paneContext={props} {...viewOptions(props.pane.id)} />;
}
export function ThreeDemo({ children }: { children: ReactNode }) {
  return (
    <ThreeSessionProvider
      onReady={(value) => {
        session = value;
      }}
    >
      <SharedScene>
        <SceneContent />
        <Helpers />
      </SharedScene>
      {children}
    </ThreeSessionProvider>
  );
}
function Helpers() {
  useEffect(() => cameraHelpers(session.scene), []);
  return null;
}
Object.defineProperty(window, 'threeDemo', {
  get: () => ({ workspace, session, cameras, counters }),
});
