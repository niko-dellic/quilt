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
