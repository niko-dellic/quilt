# Host compatibility

Quilt core contains no browser APIs. The vanilla renderer needs a live browser
document; React uses the same renderer. Desktop support does not add a runtime
dependency to either published package.

| Configuration                              | Status                                                     | Scope                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Chromium, Firefox, WebKit                  | Tested by browser suite                                    | Docking, themes, JSON, interactions, same-origin companion lifecycle                                |
| React 18.3 and 19                          | Tested with packed packages                                | Public imports, provider context, mount/popout/return/disposal                                      |
| Three.js 0.186, WebGL                      | Tested in Chromium, Firefox, WebKit                        | Shared-scene views, controls, picking, per-document renderers, and companion lifecycle              |
| WebGPURenderer, native backend             | Tested in Chromium and WebKit when an adapter is available | Opt-in factory, effects, clipping, input, same-origin companions, and disposal                      |
| WebGPURenderer, WebGL fallback             | Tested in Chromium, Firefox, WebKit                        | Same viewport/lifecycle contracts without a native WebGPU adapter                                   |
| React Three Fiber 9 with React 19          | Tested in Chromium, Firefox, WebKit                        | `quilt-three/react` persistent scene owner, scheduling, events, and companion views                 |
| TypeScript 5.9 and 7                       | Tested with packed declarations                            | NodeNext and Bundler, strict and exact optional properties                                          |
| Electron 44.3.0 desktop demo               | Tested on macOS arm64/x64, Windows x64, and Ubuntu x64     | Packaged showcase: both frameworks, offline assets, themes, resize, JSON, popout/return and cleanup |
| Tauri docked webview                       | Expected; unverified                                       | Ordinary DOM layout with `popouts: false`                                                           |
| Tauri native popouts                       | Unsupported by current window API                          | Requires an asynchronous, message-based host adapter                                                |
| Vue / other DOM frameworks                 | Vanilla integration expected; unverified                   | No dedicated binding; application supplies mount/update/dispose                                     |
| Cross-origin or independent native windows | Unsupported                                                | Current companions require synchronous same-origin DOM access                                       |
| SSR                                        | Core supported; renderer requires a client mount           | Quilt UI mounts on the client                                                                       |

## Three.js extension

The React 18.3 compatibility row applies to `quilt-react`, not the R3F adapter.
`quilt-three/react` requires React 19 with R3F 9. The base `quilt-three` entry
requires Three.js but does not import React or R3F. Existing Quilt packages do not
depend on Three.js.

WebGL graphics tests run in all three browser engines. Native WebGPU tests require
an actual adapter and assert that Three.js selected its WebGPU backend. The dedicated
Chromium WebGPU project uses test-only SwiftShader flags and requires an adapter;
other environments explicitly skip native cases when unavailable. Native Firefox
WebGPU was unavailable on the validation host; its WebGL fallback is tested.
Hardware and operating-system coverage is not implied by browser-engine coverage.
XR, worker rendering, material overrides, and built-in effect collections are deferred.
Companions remain same-origin views owned by the main session. See the
[extension guide](three.md) and [package guide](https://github.com/niko-dellic/quilt/tree/main/packages/three)
for ownership, custom pipeline, input, and clipping limitations.

## Electron reference host

[The starter](https://github.com/niko-dellic/quilt/blob/main/examples/electron) uses `BrowserWindow` with
`contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
Only Quilt's `about:blank` child windows are allowed; child navigation and further
child creation are denied. No preload or Node access is needed by pane content.

Electron supports same-origin `window.open` children through a native window and
DOM Window pair. This fits Quilt's current session-owned companions.
See [Electron's window-opening documentation](https://www.electronjs.org/docs/latest/api/window-open).

Run `npm run pack:all && npm run test:examples` to build temporary consumers and
test docked content, popout/return, theme propagation, workspace JSON, optional
confirmation, disposal, and host-window closure. On Linux use
`xvfb-run -a npm run test:examples` after installing Electron's system dependencies
and Playwright Chromium. The packaged showcase is also tested on matching native runners through the
Desktop demo workflow. This does not imply support for every Linux distribution.

Popouts remain temporary session views on every host. This example does not
restore native windows on launch, implement IPC data synchronization, or package
an executable installer. A future Tauri adapter should reuse the core and DOM
renderer while handling readiness, messaging, and lifecycle in a host-specific layer.

## Desktop downloads

[Quilt Demo](https://quilt-layouts.vercel.app/electron.html) packages the vanilla and React
demos with Electron. Source and packaging instructions are in
[desktop/README.md](https://github.com/niko-dellic/quilt/blob/main/desktop/README.md). These builds have no trusted developer certificate; macOS bundles use an ad-hoc
signature and are not notarized. The [release notes](https://github.com/niko-dellic/quilt/blob/main/docs/desktop-release.md) explain
OS approval prompts.
