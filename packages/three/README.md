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
import { ThreeSession } from 'quilt-three';
import 'quilt-vanilla/styles.css';

const scene = new Scene(); // Populate and own assets in your application.
const camera = new PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(5, 5, 5);
camera.lookAt(0, 0, 0);
const session = new ThreeSession({ scene, window });
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

`register()` returns a `ThreeView` class instance and registers cleanup with Quilt.
The session retains its main renderer until session disposal, even if all panes
are hidden, closed, or popped out. Companion renderers are released when unused.
The main application must dispose the session explicitly.

## Classes and camera helpers

`ThreeSession` owns renderers and scheduling. `ThreeView` owns each mounted viewport's
controls, input, pipeline, and cleanup; obtain it through `session.register()`.
`createThreeSession(options)` remains a convenience wrapper for `new ThreeSession(options)`.
Pure geometry utilities remain functions, and controls/pipelines implement interfaces without
requiring inheritance. React components wrap these same instances.

```ts
import { CameraHelpers } from 'quilt-three';

const helpers = new CameraHelpers(session, {
  visible: true,
  ray: 'pointer', // 'center' (default), 'pointer', or false for markers only
  maxDistance: 10,
});
helpers.setVisible(false); // Hide all markers and rays.
helpers.setCameraVisible(camera, false); // Hide one source camera's visualization.
helpers.dispose();
```

Helpers follow registered cameras, omit a camera's own visualization in its viewport,
and never change camera layers. Markers show position, orientation, and up direction: perspective cameras use a
triangle above the frame; orthographic cameras use a circular ring.
Pointer rays use pane-local coordinates (including companion windows), hit the first
visible scene surface, and revert to the center on leave. Orthographic picking uses an
offset parallel ray, with the displayed line connecting the camera marker to its endpoint.
A small circular dot marks actual ray intersections; rays that miss have no endpoint dot.
Helpers do not participate in picking. `ray: false` leaves camera markers visible.

Optional `cameras` retains an explicit set of source cameras, even without mounted views;
`visibleIn(camera)` filters the viewing cameras that display helpers. `color` and `size`
customize the wireframe. There is no helper count limit or reserved camera layer.
Disposal is idempotent and releases only helper-owned graphics. Session disposal also
disposes attached helpers, without disposing application scene assets.

In React, place `<CameraHelpers visible={showCameras} ray="pointer" />` from
`quilt-three/react` inside `ThreeSessionProvider`, alongside `SharedScene` and the workspace.
`visible` updates reactively; other helper options are mount-only. Unmounting cleans up
the helper instance, including React Strict Mode effect replays.

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
- Controls factories receive `{ camera, element, invalidate, inputScope }`. Return `enabled`,
  `update(delta)` (true while another frame is needed), and `dispose()`.
- Subscribe controls change events to `invalidate`, and unsubscribe in `dispose`.
  `NavigationControls` handles invalidation and cleanup itself. All demo workspaces
  share this adapter. In Orbit, right-drag, Shift-drag, and middle-drag pan with
  damping; pane menus remain available from the tab bar. No additional controls
  package is required.
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
the scene and camera poses. Each camera has a compact oriented marker and a ray
ending at the nearest visible scene surface or the maximum picking distance (10 world
units by default). Hovering a viewport aims its ray through the cursor; leaving restores
the center ray. Each pane's **Camera helper** button toggles that camera's marker and
ray in the other panes. A camera never displays its own helper; camera layers are unchanged.

Select **Custom views** to configure rows and columns. Helpers start hidden. The
**Camera helpers** button beside **Apply grid** toggles them globally, including
new viewports added by changing the grid. Both per-camera and global preferences
persist across workspace switches and grid changes for the current demo session.
These controls are shared by the vanilla and React demos and use `CameraHelpers`.

### Synchronizing demo cameras

The link icon toggles **Sync camera positions**. In **4 view**, use the button in
any pane to align the other cameras to that pane's exact XYZ position. In **Custom
views**, the button beside the grid controls starts from the first viewport.
While enabled, moving a camera updates the other cameras in that workspace to the
same position. Each camera keeps its own orientation and zoom; its controls target
moves with its position so subsequent input preserves its viewing direction.
While sync is enabled, camera helpers are hidden and their buttons are disabled.
Turning sync off restores the previous helper settings and independent movement without resetting camera poses.
The two workspaces retain their own toggle settings for the current demo session.

## Optional Free navigation

`NavigationControls` is an optional class implementing `ViewControls`. It combines
OrbitControls with keyboard navigation and works through the same controls factory
in vanilla and React. Other controls factories remain supported.

```ts
import { PerspectiveCamera, Vector3 } from 'three';
import { NavigationControls } from 'quilt-three';
import type { ControlsContext, ViewOptions } from 'quilt-three';

const camera = new PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(5, 5, 5);
const target = new Vector3(); // Application-owned orbit point for this camera.
camera.lookAt(target);

const controls = (context: ControlsContext) =>
  new NavigationControls(context, {
    target,
    orbitTargetPolicy: 'follow',
    speed: 2,
    minSpeed: 0.05,
    maxSpeed: 100,
    boostMultiplier: 4,
    acceleration: 0.15,
    braking: 0.15,
    lookSensitivity: 0.003,
    bindings: { forward: ['KeyW', 'ArrowUp'], down: [] },
  });

const viewOptions: ViewOptions = { camera, controls };
// Vanilla: session.register(paneContext, viewOptions).
// React: <ThreeView paneContext={paneContext} {...viewOptions} />.
```

Keep React camera and factory references stable: changing their identity remounts
the view. Use a separate application-owned target for each independently controlled
camera. No global installation or Three.js prototype changes are needed.

### Mouse and keyboard controls

These are the default bindings; the example above disables Q/down deliberately.

| Input                            | Orbit                   | Free navigation                                                     |
| -------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| Left-drag                        | Orbit around the target | Stop translation, return to Orbit, and start orbiting               |
| Right-drag                       | Damped pan              | Yaw and pitch without adding roll                                   |
| Middle-drag or Shift + left-drag | Damped pan              | Use left-drag to return to Orbit first                              |
| Wheel                            | Zoom                    | Adjust movement speed within its limits                             |
| W / Up, S / Down                 | Enter Free navigation   | Move forward / backward along the camera direction, including pitch |
| A / Left, D / Right              | Enter Free navigation   | Strafe along camera-right                                           |
| Q / E                            | Enter Free navigation   | Move down / up along `camera.up`                                    |
| Shift                            | Modifies Orbit gestures | Boost movement speed                                                |
| Escape                           | Cancel an active drag   | Stop immediately and return to Orbit                                |
| Double-click                     | Reset original pose     | Reset original pose and return to Orbit                             |

Hover the viewport to use navigation keys. Diagonal movement is normalized, and
movement accelerates smoothly. Releasing keys brakes smoothly but leaves Free
navigation active. The demos display a noninteractive indicator with an Escape hint
while Free navigation is active. The library leaves overlay UI to the application.

Both perspective and orthographic cameras retain their projection. In orthographic
views, forward movement changes camera position without perspective-style zoom.
Native context menus are suppressed on viewport input surfaces; Quilt pane menus
remain available from the tab bar.

### Options and defaults

| Option                     | Default                              | Meaning                                                                    |
| -------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| `target`                   | A point 10 units ahead of the camera | Mutable application-owned `Vector3` used as the orbit target               |
| `orbitTargetPolicy`        | `'follow'`                           | Target behavior when returning to Orbit; see below                         |
| `speed`                    | `2`                                  | World units per second, clamped to the speed limits                        |
| `minSpeed` / `maxSpeed`    | `0.05` / `100`                       | Bounds for the base movement speed, including wheel adjustments            |
| `boostMultiplier`          | `4`                                  | Multiplier while a boost key is held                                       |
| `acceleration` / `braking` | `0.15` / `0.15`                      | Time constants in seconds; larger values accelerate or stop more gradually |
| `lookSensitivity`          | `0.003`                              | Radians per CSS pixel during Free mouse-look                               |
| `bindings`                 | The keys listed above                | `KeyboardEvent.code` arrays per action                                     |

Numeric options must be positive and finite; `maxSpeed` must be at least `minSpeed`.
Acceleration and braking describe Free navigation inertia, not Orbit damping.
Orbit and pan currently use a fixed damping factor of `0.12`.

Bindings accept `forward`, `backward`, `left`, `right`, `down`, `up`, and `boost`.
Omitted actions retain defaults, supplied arrays replace them, and empty arrays
disable them. For example, `{ forward: ['KeyI'], down: [] }` replaces W/Up with I,
disables Q/down, and leaves all other actions unchanged. The default boost codes are
`ShiftLeft` and `ShiftRight`.

### Orbit target policies

| Policy       | Demo label           | Behavior when returning to Orbit                                                                       |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------------------ |
| `'follow'`   | Follow navigation    | Retain the viewing direction; put the target ahead at the distance saved when Free navigation began    |
| `'preserve'` | Preserve orbit point | Restore the world-space target saved when Free navigation began; turn the camera toward it immediately |

During Free translation, the working target moves by the same XYZ displacement as
the camera. Follow then rebuilds that target on return:

```text
target = camera position + viewing direction × previous orbit distance
```

Follow includes vertical displacement and pitch. Preserve restores the full saved
point instead. Its return changes orientation as needed, but retains camera position
and zoom. The saved point survives pane remounts and companion transitions.

Assign `controls.orbitTargetPolicy` at runtime to choose the policy for the next
return without moving the camera immediately. A change made while Free navigation
is active uses the point saved on entry to that navigation sequence.

In both demos, **Settings → Camera navigation → Orbit target** exposes these two
choices, with Follow selected initially. The choice applies to all viewports and
survives workspace changes and popouts for the current demo session. The **Hotkeys**
tab documents the keyboard and mouse controls; arrow keys navigate the hovered
viewport, while focused tabs retain their tab-switching shortcuts.

### Runtime API

| Member                 | Behavior                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `mode`                 | Read `'orbit'` or `'free'`                                                                                 |
| `setMode(mode)`        | Switch modes, clearing held movement and velocity                                                          |
| `speed`                | Read or set base speed; assignments are clamped to the configured limits                                   |
| `orbitTargetPolicy`    | Read or set `'follow'` or `'preserve'`                                                                     |
| `camera` / `target`    | Access the controlled camera and mutable orbit target                                                      |
| `enabled`              | Enable or disable input; disabling stops movement                                                          |
| `setPosition(Vector3)` | Translate camera and working target together, preserving orientation and zoom and clearing residual motion |
| `reset()`              | Restore the original pose and Orbit mode                                                                   |
| `update(delta)`        | Advance controls in seconds; return true while another frame is needed                                     |
| `dispose()`            | Remove listeners and dispose the underlying OrbitControls; safe to call again                              |

`setPosition()` does not replace the saved Preserve return point during Free
navigation. This makes it suitable for position synchronization without rotating
peer cameras. Speed and target policy are runtime settings; bindings, speed limits,
boost, inertia, and sensitivity are constructor options.

Use `addEventListener('change', handler)` for camera changes and
`addEventListener('modechange', handler)` for mode changes; the latter event carries
`mode`. Remove application subscriptions when their owner is disposed.

### Scheduling and input ownership

The controller invalidates its session automatically and advances through the existing
session scheduler. It creates no animation loop; on-demand rendering settles after
movement and damping stop. The React adapter uses the same scheduling infrastructure.

Only one hovered viewport owns keyboard navigation within a session, including
companions. Inputs, textareas, selects, editable content, visible menus/dialogs, and
Ctrl/Meta/Alt shortcuts are excluded. Leaving a viewport, switching hovered panes,
losing window focus, hiding/disabling a view, or disposing controls stops keyboard
motion immediately. Held-key repeat cannot transfer movement to another pane:
a fresh key press is required. After editing a form control, focus the viewport to
resume navigation.

Camera pose, target, mode, and speed survive remounts within the same session; held
keys and velocity do not. `ThreeSession` supplies `ControlsContext.inputScope` for
shared ownership and retained state. Standalone controllers may supply the same
scope object across documents; without one, the scope is the input element's document.

Mounted views dispose their controls. View teardown never disposes shared scene
assets. Collision detection, gravity, pointer lock, and gamepad navigation are outside
this controller's scope.
