# Host compatibility

Quilt core contains no browser APIs. The vanilla renderer needs a live browser
document; React uses the same renderer. Desktop support does not add a runtime
dependency to either published package.

| Configuration                              | Status                                                 | Scope                                                                                               |
| ------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Chromium, Firefox, WebKit                  | Tested by browser suite                                | Docking, themes, JSON, interactions, same-origin companion lifecycle                                |
| React 18.3 and 19                          | Tested with packed packages                            | Public imports, provider context, mount/popout/return/disposal                                      |
| TypeScript 5.9 and 7                       | Tested with packed declarations                        | NodeNext and Bundler, strict and exact optional properties                                          |
| Electron 44.3.0 desktop demo               | Tested on macOS arm64/x64, Windows x64, and Ubuntu x64 | Packaged showcase: both frameworks, offline assets, themes, resize, JSON, popout/return and cleanup |
| Tauri docked webview                       | Expected; unverified                                   | Ordinary DOM layout with `popouts: false`                                                           |
| Tauri native popouts                       | Unsupported by current window API                      | Requires an asynchronous, message-based host adapter                                                |
| Vue / other DOM frameworks                 | Vanilla integration expected; unverified               | No dedicated binding; application supplies mount/update/dispose                                     |
| Cross-origin or independent native windows | Unsupported                                            | Current companions require synchronous same-origin DOM access                                       |
| SSR                                        | Core supported; renderer requires a client mount       | Quilt UI mounts on the client                                                                       |

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
