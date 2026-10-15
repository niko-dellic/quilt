import { createDemoRenderer } from './three-renderer.js';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useFrame, useThree } from '@react-three/fiber';
import type { PaneProps } from 'quilt-react';
import { SharedScene, ThreeSessionProvider, ThreeView, useThreeSession } from 'quilt-three-react';
import type { ThreeSession } from 'quilt-three';
import { workspace } from './model.js';
import {
  cameras,
  populate,
  viewOptions,
  createDemoHelpers,
  setThreeStatus,
} from './three-shared.js';
import { mountHelperToggle } from './camera-helper-controls.js';
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
  return (
    <ThreeView paneContext={props} {...viewOptions(props.pane.id)}>
      <HelperToggle id={props.pane.id} />
    </ThreeView>
  );
}
export function ThreeDemo({ children }: { children: ReactNode }) {
  return (
    <ThreeSessionProvider
      options={{ createRenderer: createDemoRenderer }}
      onReady={(value) => {
        session = value;
      }}
    >
      <SharedScene>
        <SceneContent />
      </SharedScene>
      <Helpers />
      {children}
    </ThreeSessionProvider>
  );
}
Object.defineProperty(window, 'threeDemo', {
  get: () => ({ workspace, session, cameras, counters }),
});

function HelperToggle({ id }: { id: string }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => (element.current ? mountHelperToggle(element.current, id) : undefined), [id]);
  return <div ref={element} />;
}
function Helpers() {
  const owner = useThreeSession();
  useEffect(() => {
    return createDemoHelpers(owner).dispose;
  }, [owner]);
  return null;
}
