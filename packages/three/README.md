# quilt-three (experimental)

Shared-scene Three.js viewports for Quilt, with optional React Three Fiber bindings.
The main workspace shares one WebGL canvas. Each same-origin companion document
has its own renderer. Geometry, authored materials, and camera poses remain
application-owned; moving a pane does not delete scene data.

## Install

```sh
npm install quilt-three three
npm install --save-dev @types/three
```

The current experimental compatibility target is Three.js r186. For React:

```sh
npm install quilt-react react@^19 react-dom@^19 @react-three/fiber@^9.8.1
```

`quilt-three` does not import or install React or R3F. The `/react` entry requires
React 19 and R3F 9.8.1 or newer within major 9. The optional React peer range also
allows React 18 applications to use the **imperative base entry** without adopting
R3F. Existing `quilt-react` React 18 support is unchanged.

## Vanilla

```ts
import { Scene, PerspectiveCamera } from 'three';
import { Workspace, createLayout } from 'quilt-vanilla';
import { createThreeSession } from 'quilt-three';
import 'quilt-vanilla/styles.css';

const scene = new Scene(); // Populate and own assets in your application.
const camera = new PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(5, 5, 5);
camera.lookAt(0, 0, 0);
const session = createThreeSession({ scene, window });
const workspace = new Workspace({
  container: document.querySelector<HTMLElement>('#workspace')!,
  initialLayout: createLayout({ pane: { id: 'perspective', type: 'three', title: 'Perspective' } }),
  paneTypes: {
    three: {
      title: 'Perspective',
      render(context) {
        return session.register(context, { camera });
      },
    },
  },
});

// After changing scene data:
session.invalidate();
// At application shutdown:
workspace.dispose();
session.dispose();
// Dispose application-owned geometries/materials/textures separately.
```

Keep cameras in an application map keyed by pane ID for multiple views. Do not
put Three.js objects in layout params. Perspective aspect follows each pane;
orthographic resizing preserves its vertical extent, horizontal center, and zoom.

`register()` returns a disposable pane view and registers cleanup with Quilt.
The session retains its main renderer until session disposal, even if all panes
are hidden, closed, or popped out. Companion renderers are released when unused.
The main application must dispose the session explicitly.

## React Three Fiber

```tsx
import { Workspace } from 'quilt-react';
import type { PaneProps } from 'quilt-react';
import { SharedScene, ThreeSessionProvider, ThreeView } from 'quilt-three/react';

// `camera` and `initialLayout` are application-owned, as in the vanilla example.
function ScenePane(props: PaneProps) {
  return <ThreeView paneContext={props} camera={camera} />;
}

function App() {
  return (
    <ThreeSessionProvider>
      <SharedScene>
        <mesh onClick={() => console.log('selected')}>
          <boxGeometry />
          <meshStandardMaterial color="teal" />
        </mesh>
        <ambientLight intensity={2} />
      </SharedScene>
      <Workspace
        initialLayout={initialLayout}
        paneTypes={{ three: { title: '3D', render: ScenePane } }}
      />
    </ThreeSessionProvider>
  );
}
```

Declare one `SharedScene` per provider. Its R3F tree remains mounted while views
move or pop out. `ThreeView` children are **HTML overlays**, not additional R3F
scenes. Application contexts used by scene content should be explicitly provided
inside `SharedScene`: its R3F root is separate from the DOM React root.

`useFrame` runs once per session tick, not once per camera. `useThree().camera`
outside an input callback is the scene owner's default camera; pass view cameras
explicitly to view-specific logic. Use `useThreeSession().invalidate()` after
external changes. Provider options are mount-only; camera/controls/pipeline
identity changes remount that view, so keep factory references stable.

The adapter advances R3F in manual mode and performs all view drawing afterward.
Do not add another automatic render loop or a competing positive-priority renderer.
Pointer events are forwarded from each pane using its camera, including companions.
R3F event state belongs to the shared root; simultaneous multi-pointer interaction
across different documents is not a supported interaction model in this release.

## Scheduling, controls, and graphics

- The frame scheduler uses a visible companion when the main document is hidden.
- Demand rendering is the default. Set `frameloop: 'always'` for continuous animation.
- `update(delta)` advances shared simulation once per tick; hidden views skip drawing.
- Pixel ratio follows each document and is capped at 2 by default; configure `maxPixelRatio`.
- Controls factories receive `{ camera, element, invalidate }`. Return `enabled`,
  `update(delta)` (true while another frame is needed), and `dispose()`.
- Subscribe controls change events to `invalidate`, and unsubscribe in `dispose`.
  All demo workspaces share the same OrbitControls adapter with orbit, zoom, reset,
  and drag cancellation. Orbit and pan use damping; no controls dependency is required by the package.
- Only the first live view of a given camera accepts input during overlapping mounts.
  Use independent cameras for independently interactive docked views.
- A renderer factory receives a canvas created in the correct document. Return a
  fresh renderer owned by the session; do not share it with another session/root.
- The default canvas host is the closest Quilt workspace/companion. `container(doc)`
  can supply an explicit positioned host. Avoid transformed/scaled ancestors and
  arbitrary nonrectangular clipping in this experimental release.
- Renderer initialization failure rejects mounting. Quilt preserves the original
  view if a companion cannot initialize. Context loss pauses that surface, reports
  the error, and redraws when the context is restored.

## Custom pipelines and the effect proof

A view may supply `pipeline(renderer)`, returning `resize(width, height, dpr)`,
`render(frame)`, and `dispose()`. Width and height are CSS pixels. The pipeline is
created per mounted view and must release its own targets, materials, and geometry.
Caller-supplied scene assets must remain untouched.

The session sets the output viewport/scissor before rendering. A pipeline must
restore any renderer state it changes, including target, viewport, scissor, clear
settings, and color/tone-mapping configuration. No arbitrary third-party composer
compatibility is promised. Render target resources cannot cross WebGL contexts.

The demo's grayscale pipeline renders into a pane-sized target, then composites
into the pane's scissored rectangle. Other panes retain their ordinary materials.
It is a validation example, not a built-in effect API.

## Examples and validation

From the repository, build before serving:

```sh
npm run build
npm run dev
```

- `/vanilla.html?workspace=three`: Three.js workspace in the vanilla demo.
- `/react.html?workspace=three`: Three.js workspace with a persistent R3F scene.
- Add `&effects` to either for independent grayscale processing on the perspective view.
- `npm run benchmark:three`: writes `artifacts/three-benchmark.json` with CPU submission
  timings, draw calls, resource counts, and GPU timings when the extension is available.

Browser integration currently validates WebGL with Chromium. Existing Quilt browser
coverage still runs across Chromium, Firefox, and WebKit. Treat cross-browser graphics,
third-party R3F components, and production workload performance as experimental.
Material overrides, WebGPU, XR, workers, and effect collections are deferred.

Select **4 view** in the existing workspace switcher. Switching presets preserves
the scene and camera poses. Camera rays show the other three cameras in each
4 view pane, ending at the nearest scene surface or 10 world units. Custom views
hides the rays; camera layers exclude each camera’s own ray without material overrides.
