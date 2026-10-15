# Three.js release validation

This record describes the supported scope and release checks for quilt-three 0.10.0.
The package targets Three.js r186, with React 19 and R3F 9 for its React entry.
WebGL and WebGPU are supported rendering backends; XR, workers, material overrides,
and built-in effect collections are not part of this release.

## Public API review

- `ThreeSession` owns scheduling and one renderer per workspace document. Scene assets
  and camera poses belong to the application. Shared updates run once per session tick.
- `register(context, options)` returns a `ThreeView`. Views own controls, input,
  observers, and per-view pipelines. Unmounting does not dispose shared assets.
- Renderer factories may return an instance or a promise. Quilt includes asynchronous
  initialization in its destination-ready transaction. Failed popouts retain the
  source; cancelled mounts settle without reporting a spurious initialization failure.
- `ThreeView.ready` acknowledges initialization and its first draw. View disposal is
  synchronous and idempotent. Session disposal detaches views synchronously and
  returns a promise for pending renderer/device cleanup, including late factory results.
- `quilt-three/webgpu` exports `createWebGPURenderer`. Native devices are acquired
  through the canvas document's navigator and released with the renderer. This is
  essential for companion documents; an opener-owned device cannot be assumed to
  configure a companion canvas correctly in every browser.
- Pipelines initialize per view after renderer readiness, resize in CSS pixels plus
  device pixel ratio, render into the supplied viewport/scissor, and dispose their
  own resources. They must restore changed renderer state. GLSL and node-material
  examples validate isolated effects; arbitrary composer compatibility is not promised.
- The React provider retains one R3F scene owner and scheduling path. Scene JSX lives
  in `SharedScene`, while pane HTML lives in `ThreeView`. Options on the provider are
  mount-only. Existing React 18 support in quilt-react is unaffected.
- WebGL context restoration redraws the affected surface. Native GPU device loss
  pauses its surface and reports through `onError`; recovery requires a new session.

Review findings addressed: WebGL-only renderer types and statistics, top-left WebGPU
viewport coordinates, clipped camera projection, asynchronous readiness/disposal,
Strict Mode cancellation, document-owned GPU devices, late factory cleanup, and
per-view pipeline resize error isolation, and camera projection when moving between
WebGL and native WebGPU. No scene prototype or global installation
API is introduced.

## Browser and lifecycle coverage

`tests/browser/three.spec.ts` runs graphics integration in Chromium, Firefox, and
WebKit. It covers shared scenes, controls and picking, per-view effects and resize,
DPI, hidden/zero-sized panes, pointer capture, camera persistence, failed/blocked
popouts, return, and application asset ownership.

`tests/browser/three-backends.spec.ts` covers WebGPURenderer with both native and
WebGL backends, image-based effect isolation, clipping without invalid GPU viewports,
companion return, stable resource counts, React Strict Mode, repeated mount/dispose,
initialization rejection, closure while pending, and factory results arriving after
unmount. The native tests assert the backend identity rather than accepting fallback.

Native WebGPU was exercised in WebKit on macOS and Chromium with SwiftShader.
Default headless Chromium and Firefox exposed no native adapter on this host;
those cases explicitly skip native tests while running fallback tests. The dedicated
`chromium-webgpu` project requires an adapter and uses test-only
`--enable-unsafe-webgpu --use-angle=swiftshader` flags. Applications do not need or
receive these flags. A software adapter does not establish hardware-driver coverage.

## Performance measurements

Run the comparative benchmark after building:

```sh
npm run build
npm run benchmark:three
QUILT_THREE_BENCHMARK=1 QUILT_THREE_BACKEND=webgpu npx playwright test tests/browser/three-benchmark.spec.ts --project=chromium-webgpu
```

The runs write `artifacts/three-benchmark.json` and
`artifacts/three-benchmark-webgpu.json`. Each measures 30 and 1,000 objects with one
and four visible views, with and without a grayscale effect. The report includes
CPU submission median/p95, draw calls, resource counts, and GPU timing when supported.
The benchmark allows three minutes to finish rather than relying on the ordinary
30-second test timeout. It is a measurement harness, not a frame-rate assertion.

CPU submission does not measure GPU completion. WebGL GPU queries can be unavailable
or disjoint; native WebGPU queries depend on the adapter's timestamp-query feature.
Reported GPU times must be interpreted with the named backend and environment.
A production workload still needs its own geometry, material, resolution, and
hardware measurements.

### Measurements on 2026-10-14

These are host-specific samples, not backend rankings. GPU means cover the measured
render passes. CPU columns are median submission times in milliseconds.

| Objects | Views | Effect | WebGL CPU (Chromium) | WebGPU CPU (WebKit) | WebGPU GPU mean (WebKit) | WebGPU CPU (SwiftShader) | WebGPU GPU mean (SwiftShader) |
| ------- | ----- | ------ | -------------------- | ------------------- | ------------------------ | ------------------------ | ----------------------------- |
| 30      | 1     | No     | 0.5                  | 2                   | 0.25                     | 0.8                      | 17.9                          |
| 30      | 1     | Yes    | 0.5                  | 1                   | 0.30                     | 0.8                      | 12.0                          |
| 30      | 4     | No     | 1.3                  | 2                   | 1.09                     | 1.7                      | 70.8                          |
| 30      | 4     | Yes    | 1.5                  | 2                   | 1.16                     | 1.9                      | 64.3                          |
| 1,000   | 1     | No     | 7.5                  | 10                  | 0.83                     | 11.4                     | 96.7                          |
| 1,000   | 1     | Yes    | 7.9                  | 10                  | 1.32                     | 10.8                     | 83.5                          |
| 1,000   | 4     | No     | 29.8                 | 40                  | 3.44                     | 40.3                     | 372.1                         |
| 1,000   | 4     | Yes    | 31.1                 | 45                  | 3.69                     | 44.7                     | 368.5                         |

WebGL timer queries were unavailable. WebKit and SwiftShader supplied native WebGPU
timestamp queries. Noise can make an effect sample appear faster than its baseline;
these runs do not establish an effect speedup. The WebKit artifact is
`artifacts/three-benchmark-webgpu-webkit.json`; reproduce it with the same WebGPU
command and `--project=webkit`.

The large scene uses separate meshes, material groups, and edge outlines: four
views submit 28,044 WebGL draw calls or 28,048 WebGPU draw calls before the effect.
It exceeds a 60 Hz CPU budget on this host and needs application-level batching or
instancing for that target. Quilt does not merge authored geometry automatically.
Geometry/texture counts remain constant between one and four views: WebGL reports
20/0 without effects and 21/1 with the effect; WebGPU reports 21/2 and 22/4.
Repeated companion tests also verify return to the main renderer's resource baseline.

## Release gates

Run `npm run check` for builds, strict typing, unit and browser tests, packed imports,
starter applications, documentation links, and site checks. Packed consumers verify
base and WebGPU imports without installing React/R3F, and the React entry with React 19. Follow with `npm run release:rehearse` to validate version/changelog agreement and
archives without publication. Registry authorization and CI on the reviewed commit
remain separate from these local checks.
