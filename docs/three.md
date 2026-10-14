# Experimental Three.js integration

`quilt-three` adds shared-scene camera views and optional React Three Fiber bindings
without adding Three.js to the existing core, vanilla, or React packages.

See the [package guide](https://github.com/niko-dellic/quilt/tree/main/packages/three)
for installation, APIs, ownership, controls, rendering pipelines, and limitations.

Every demo preset—Default, Focus, Review, 4 view, and Custom views—uses the same
Three.js scene and controls. The vanilla and React adapters share the scene builder
and viewport options; React owns one persistent R3F scene tree. Preset changes only
rearrange views and select cameras. Drag to orbit, scroll to zoom, double-click to
reset, and press Escape during a drag to cancel. Right-drag, Shift-drag, or middle-drag pans, with damping shared by orbit and pan. Pane menus remain available from the tab bar; canvas drags do not open them.

After `npm run build` and `npm run dev`, open `/vanilla.html?workspace=three` or `/react.html?workspace=three`.
Choose **4 view** in either demo’s workspace switcher. Camera poses and the shared
scene survive switching to another workspace and back. Each view displays a compact
oriented marker and a ray for each of the other cameras. Rays stop at the first visible
scene surface or the maximum picking distance (10 world units by default). Hovering
a viewport aims its ray through the cursor; leaving restores the center ray. A small
dot marks a surface intersection; no dot appears when the ray misses.

Each **4 view** pane has a **Camera helper** button that toggles its camera's marker
and ray in the other panes. **Custom views** starts with helpers hidden; the
**Camera helpers** button beside **Apply grid** toggles them globally, including
new viewports added by changing the grid. These settings persist across workspace
switches and grid changes for the current demo session.

The four views reuse the architectural study and surface colors across every workspace, with the Theming / Inspector / Activity sidebar alongside them.
Both examples have picking, independent controls, and companion windows.
Add `&effects` to exercise a grayscale pipeline on one view while the other views
use ordinary rendering.

The **Custom views** preset adds a top pane with **Rows**, **Columns**, and
**Apply grid**. Each dimension accepts positive whole numbers without a demo-imposed
maximum. This preset uses the full width for viewports, without the right sidebar. Camera poses stay
associated with their grid cells when reducing and expanding the grid. Open
`/vanilla.html?workspace=custom` or `/react.html?workspace=custom` directly.

## Ownership

The stateful APIs are classes: `new ThreeSession(options)` owns rendering and
scheduling, `session.register()` returns a `ThreeView` that owns viewport resources,
and `new CameraHelpers(session, options)` owns the optional visualizations.
`NavigationControls` owns each view's optional Orbit and Free navigation controls.
`createThreeSession(options)` remains a convenience wrapper. React components wrap
the same class instances; pure geometry utilities remain functions.

The application owns scene data and camera poses. The session owns a renderer per
document; individual mounted views own controls and effect resources. The React
adapter owns one persistent R3F scene tree, outside pane lifetimes. The session ends
when its owner is disposed, not when its last visible pane closes.

`PaneContext.deferReady(promise)` lets pane integrations delay Quilt's readiness
barrier beyond synchronous mounting or React commit. Register during mount or a
React layout effect. A rejection rolls back a pending popout; the source remains
usable. It does not turn asynchronous mount functions into supported renderers.

## Performance validation

Run `npm run benchmark:three` for 30 and 1,000 objects, with one and four visible
views, with and without the example effect. Results go to
`artifacts/three-benchmark.json`. CPU time measures submission, not GPU completion.
GPU time is recorded only if timer queries are available and valid. Browser, driver,
resolution, and software rendering substantially affect the results; these are
comparative measurements, not frame-rate guarantees.

Material overrides are intentionally absent from this baseline. Future display
policies should remain separate from authored scene materials.

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

## Free navigation

All presets in both demos use the optional `NavigationControls` class from
`quilt-three`. Scene content, camera controls, and camera state are shared across
layouts; switching presets does not create a different implementation of the scene.

| Input                            | Behavior                                                               |
| -------------------------------- | ---------------------------------------------------------------------- |
| Left-drag                        | Orbit; from Free navigation, stop translation and return to Orbit      |
| Right-drag                       | Pan in Orbit; look around in Free navigation                           |
| Middle-drag or Shift + left-drag | Damped pan in Orbit                                                    |
| W/S or Up/Down                   | Enter Free navigation and move forward/backward along camera direction |
| A/D or Left/Right                | Enter Free navigation and strafe                                       |
| Q/E                              | Move down/up along the camera's up axis                                |
| Shift                            | Move faster during Free navigation                                     |
| Wheel                            | Zoom in Orbit; adjust movement speed in Free navigation                |
| Escape                           | Stop Free navigation and return to Orbit, or cancel an Orbit drag      |
| Double-click                     | Reset the original camera pose and return to Orbit                     |

Hover the viewport to use navigation keys. Forward motion includes camera pitch;
diagonals are normalized. Movement accelerates and brakes smoothly. Releasing keys
leaves Free navigation active, with a small noninteractive indicator and Escape hint.
Orthographic cameras retain their projection: forward motion translates them without
perspective-style zoom.

Only the hovered viewport owns keyboard navigation, including across companion
windows. Leaving it, switching panes, losing focus, or hiding/disabling a view stops
movement immediately. A held key does not carry movement into another pane; press
it again. Form fields, menus/dialogs, and Ctrl/Meta/Alt shortcuts keep their normal
keyboard behavior. After editing a field, focus the viewport to resume navigation.

### Orbit target behavior

Use **Settings → Camera navigation → Orbit target** in either demo:

| Choice                          | Behavior                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Follow navigation** (default) | Keep the current viewing direction and place the target ahead at the previous orbit distance. All XYZ displacement, including height, is taken into account. |
| **Preserve orbit point**        | Restore the world-space point saved on entering Free navigation and immediately turn toward it. Camera position and zoom stay unchanged.                     |

The setting applies to all viewports and survives layout changes and popouts for
the current demo session. Changing it takes effect the next time you return to Orbit;
it does not move the camera immediately. The **Hotkeys** tab lists navigation and
workspace shortcuts. Arrow keys navigate a hovered viewport; when a tab is focused,
they retain the tab-switching behavior described there.

### Application API

Create controls through the view's existing factory in either adapter:

```ts
import { NavigationControls } from 'quilt-three';
import type { ControlsContext } from 'quilt-three';

const controls = (context: ControlsContext) =>
  new NavigationControls(context, {
    orbitTargetPolicy: 'follow', // Or 'preserve'.
    speed: 2,
    minSpeed: 0.05,
    maxSpeed: 100,
    boostMultiplier: 4,
    acceleration: 0.15,
    braking: 0.15,
    lookSensitivity: 0.003,
    bindings: { forward: ['KeyW', 'ArrowUp'] },
  });
```

Pass `controls` to the vanilla view options or React `ThreeView`. Keep factory and
camera references stable in React. Supply `target: Vector3` when the application
owns an explicit orbit point; otherwise it starts 10 units ahead of the camera.

Speed is in world units per second. Acceleration and braking are time constants in
seconds: larger values produce slower acceleration and longer coasting. Look
sensitivity is radians per CSS pixel. These options affect Free navigation;
Orbit and pan use fixed damping. Bindings use `KeyboardEvent.code` arrays per action.
Omitted actions retain defaults, supplied arrays replace them, and empty arrays
disable them.

Read or set `controls.speed` and `controls.orbitTargetPolicy` at runtime. Use
`setMode()`, `reset()`, and `setPosition()` to control navigation explicitly. Subscribe
to `change` and `modechange` events to reflect state in application UI. The
[package guide](https://github.com/niko-dellic/quilt/tree/main/packages/three#optional-free-navigation)
covers all defaults, methods, binding actions, and ownership requirements.

Navigation advances through the existing session scheduler; it adds no animation
loop. Pose, target, mode, and speed survive remounts; held keys and velocity do not.
The mounted view disposes its controls and listeners without deleting scene assets.
Position sync still copies exact XYZ positions while preserving peer orientations
and zoom, and hides camera helpers while enabled. Collision detection, gravity,
pointer lock, and gamepad controls are not included.
