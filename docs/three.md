# Experimental Three.js integration

`quilt-three` adds shared-scene camera views and optional React Three Fiber bindings
without adding Three.js to the existing core, vanilla, or React packages.

See the [package guide](https://github.com/niko-dellic/quilt/tree/main/packages/three)
for installation, APIs, ownership, controls, rendering pipelines, and limitations.

Every demo preset—Default, Focus, Review, 4 view, and Custom views—uses the same
Three.js scene and controls. The vanilla and React adapters share the scene builder
and viewport options; React owns one persistent R3F scene tree. Preset changes only
rearrange views and select cameras. Drag to orbit, scroll to zoom, double-click to
reset, and press Escape during a drag to cancel. Shift-drag or middle-drag pans, with damping shared by orbit and pan. Right-click remains available for pane menus.

After `npm run build` and `npm run dev`, open `/vanilla.html?workspace=three` or `/react.html?workspace=three`.
Choose **4 view** in either demo’s workspace switcher. Camera poses and the shared
scene survive switching to another workspace and back. Each view displays a single center ray for each of the other three cameras. Rays
stop at the first scene surface or 10 world units. Hovering a viewport aims its ray at the cursor using that camera's picking ray; leaving restores the center ray. A compact wireframe camera at each ray's origin follows its orientation, with a triangle marking its up direction. Each 4 view pane has a **Camera helper** toggle to show or hide its camera in the other panes. Custom views starts with helpers hidden; the **Camera helpers** toggle beside Apply grid enables them globally. These settings persist across workspace switches and grid changes.
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
