# Changelog

## 0.11.0

- **Breaking:** Move React Three Fiber bindings into `quilt-three-react` and remove `quilt-three/react`. Install `quilt-three-react` and update imports. Rendering and lifecycle implementation remain shared with `quilt-three`.
- Make each Three.js integration a single-command install with required peer dependencies and TypeScript declarations. Vanilla installations do not install React or R3F.

## 0.10.0

- Add `quilt-three` with shared-scene camera views, demand rendering, one renderer per document, controls factories, picking, and per-view custom rendering pipelines. The base entry requires no React or R3F.
- Add opt-in `quilt-three/webgpu` with document-owned native devices and an explicit WebGL fallback policy. Support asynchronous renderer factories, readiness-aware popouts, clipped viewports, and awaitable GPU disposal. Keep WebGPU out of the base entry’s runtime imports.
- Validate graphics across Chromium, Firefox, and WebKit; add native WebGPU, Strict Mode, cancellation, late factory results, and repeated resource lifecycle regressions.
- Add `quilt-three/react` for React 19 and R3F 9 with a persistent shared scene owner, pane-local events, and same-origin companion views. Existing `quilt-react` support for React 18.3 and 19 is preserved.
- Add `PaneContext.deferReady` so asynchronous integrations participate in destination-ready popout transactions while preserving the source on initialization failure. Release all Quilt packages together so the Three.js adapter receives this API.
- Reuse one scene and navigation implementation across the vanilla and React workspace demos, including 4 view and configurable Custom views. Add compact ray-based camera helpers, camera position synchronization, and optional Orbit/Free navigation controls.
- Support rectangular multi-region joins that preserve the pane where the drag starts and retain joined content. Summarize large join previews instead of overflowing their labels.
- Enable optional resize snapping by default, highlight all aligned neighboring edges, and expose the setting in the demo Theming pane.
- Add dedicated panes and document the new layout, rendering, ownership, and compatibility APIs. Extend package, consumer, browser, benchmark, and documentation checks for the new extension.
- Correct the capability-policy drag test to target the tab rather than its overlapping corner handle, retaining reorder and move permission checks.

## 0.9.2

- Right-click while Add tab is open now closes the picker and opens the source pane menu at the pointer, including with the default context-menu setting.
- Extend right-click pane menus to pane content, keeping them available after Escape dismisses a menu or picker. Application context menus that prevent the event default and embedded workspaces retain priority. This changes the default right-click interaction over pane content.
- Add cross-browser regressions for picker backdrops, default and explicit menu modes, Escape, and application-owned context menus.

## 0.9.1

- Size Add tab pickers against the viewport instead of their source pane, keeping them usable in short or narrow regions.
- Clamp picker placement within screen edges and reposition on viewport resizing and scrolling, while keeping search and Cancel visible above and below the scrolling results.
- Add cross-browser coverage for bottom-edge panes, filtering, small viewports, and keyboard selection.

## 0.9.0

- Add global `contextMenu` settings for integrated buttons, tab-bar right-click, both, or neither in Vanilla and React. Both entry points are enabled by default.
- Add `contextMenuIcon` to choose three dots (default) or a larger solid single dot for integrated menu buttons across populated and empty regions.
- Reposition open pane menus on repeated right-clicks while suppressing native browser menus, including over disabled items in Firefox.
- Expose both controls in the demo Theming pane's Tab section. Settings apply live without remounting pane content and remain session configuration outside saved layouts and workspace presets.
- Add cross-browser coverage for all modes, icon choices, live updates, repeated right-clicks, and viewport clamping.

## 0.8.0

- Keep keyboard-closed submenus hidden until the pointer moves, preventing WebKit hover retargeting from reopening them.
- Wait for companion stylesheets before enhancing scrollbars, preventing initial resize observer delivery loops while preserving native scrolling during loading.
- Add shared fading scrollbars across Vanilla, React, Electron, and companion windows. New workspaces default to auto-hide, overlay placement, scroll intent only, and a 500 ms idle delay, followed by a 300 ms opacity fade that remains enabled with reduced motion.
- Expose `ScrollbarOptions` for visibility, overlay or reserved gutter placement, reveal triggers, and idle delay. Apply updates live without replacing pane content, React state, focus, or native scroll targets. Explicit `scrollbars: undefined` selects native controls.
- Save scrollbar preferences in version-1 workspace presets; older presets without them retain native behavior. Core layout JSON remains unchanged.
- Add `PaneContext.registerScrollArea({ host, viewport })` and the matching React pane prop for application-owned nested scroll areas, with automatic view cleanup.
- Add styled scrollbar controls to both demos, document the defaults and native opt-out, and extend cross-browser and desktop coverage for fading, scroll intent, gutters, nested areas, popouts, and lifecycle preservation.

## 0.7.0

- Preserve vertical and horizontal scroll positions across tab switches and maximize/restore, including nested scroll areas and inactive tabs. Scrolling while maximized remains intact on restore.
- Improve touch resizing in both border and gutter modes with wider invisible targets, visible grips on touch-only devices, and drag positioning that avoids jumps when grabbing the edge of a target.
- Keep resize gestures owned by their initiating pointer; ignore secondary touches and clean up correctly on cancellation or lost pointer capture.
- Add scroll-preservation coverage for Vanilla and React across Chromium, Firefox, and WebKit, native Chromium touch-drag tests, and cross-browser pointer ownership checks.

## 0.6.0

- Export a reusable `defaultShortcuts` preset from Vanilla and React, shared by both demos.
- Add live workspace, region, and tab capability policies, including independent controls for adding tabs, reordering, movement, maximization, closing, resizing, splitting, joining, and popouts. Existing move restrictions remain compatible.
- Add `canNode` availability checks and enforce scoped permissions for empty regions, shared dividers, and asynchronous close/popout operations. Returning companions and restoring maximized regions remain available.
- Add an optional single-border resize mode with shared pane edges and a hover/focus grip, while retaining gutter resizing and keyboard controls.
- Add a primary Settings tab to both demos for live interaction rules, shortcuts, popouts, auto-collapse, tab presentation, confirmation, and size limits.
- Improve Theming with a matching introduction, resize-style controls, conditional gutter options, and a Frozen border color picker with inherited/custom/hidden modes. Demos default to single-border resizing.
- Document the new APIs and demo controls, with browser coverage across Chromium, Firefox, and WebKit.

## 0.5.0

- Add workspace-owned custom command registration with labels, availability checks, shared action dispatch, and abortable command lifetimes.
- Add incremental shortcut registration and cleanup without replacing unrelated bindings.
- Detect conflicting shortcuts with configurable priority, warning, or atomic error policies and immutable conflict diagnostics.
- Expose command metadata and change notifications for application help panels, with live Vanilla and React support.
- Document custom commands, external hotkey integrations, conflict policies, and registration cleanup.

## 0.4.0

- Serve the documentation, generated API reference, and search index from the local demo server. Verify API navigation and search in both development and production.

- Register shortcuts for built-in workspace actions, with support for external hotkey systems and shared `executeAction`, `canExecuteAction`, and `getShortcuts` APIs.
- Show accessible, theme-aware keycaps in action menus, with alternate bindings in tooltips and live updates in Vanilla and React. Existing shortcut presets remain compatible.
- Allow shortcuts while an actions menu or submenu is open, targeting its original region and dismissing the menu. Search fields and confirmation dialogs retain keyboard protections.
- Keep hover submenus open while crossing into them, unify their appearance with the main menu, and group tab and pane closing actions under Close.
- Generate demo shortcut help from registered bindings and document external handlers, action targeting, and change notifications.

## 0.3.0

- Breaking: vanilla uses `new Workspace({ container, ...options })`; React uses `<Workspace>`, `WorkspaceProps`, and `WorkspaceHandle`. Previous mounted entry points are removed. Standalone `LayoutStore` is available only from `quilt-core`.
- Plain `paneTypes` maps and `addPane()` return pane handles with stable identity and explicit invalidation on removal or workspace replacement.
- Workspace `on('change')` covers arrangement and appearance; complete workspace loads emit one consolidated event.
- Programmatic pane/group closes honor confirmation and permissions by default, with explicit `{ force: true }` for application authority.

- Breaking: mounted vanilla and React workspaces own their store. Use `initialLayout` or `initialWorkspace`, then call workspace methods directly; no store is exposed.
- One vanilla disposal call and automatic React unmount cleanup replace separate store cleanup.
- Pane contexts expose an abort signal and cleanup registration, including rollback after failed mounts. Simple renderers can return nothing.
- Cleanup errors no longer prevent pane replacement, retry, or companion teardown.
- React provides `onReady`; early asynchronous ref calls reject consistently. Initial configuration is mount-only.
- Updated demos, starters, packed consumers, and lifecycle/migration documentation.
- Automatically enforce tab chrome minimum sizes in vanilla and React, including vertical/floating bars and theme changes, without modifying saved layouts.

## 0.2.4

- Move theme JSON export into the Theming pane in both demos and the desktop showcase.
- Add matching Colors, Spacing, and Scrollbars accordions plus font-family and frozen-border controls.
- Remove the standalone theme builder and redirect its old website URL to the vanilla demo. Update shared package documentation.

## 0.2.3

- Add a website theme builder with live preview, all public theme tokens, presets, JSON file export/import, and companion-window preview.
- Share the root README overview, WebP demo, and documentation links with all npm package READMEs; check synchronization during validation.
- Document reusable theme files and link the builder from the website and package pages.

## 0.2.2

- Simplify React installation to `npm install quilt-react` and clarify automatic Quilt dependencies and shared React peer dependencies.
- Align registry and local-archive installation instructions. No library runtime or API changes.

## 0.2.1

- Add workspace fullscreen controls to the vanilla and React demos while preserving mounted panes and keeping configuration dialogs accessible.
- Improve the responsive landing-page layout and clarify browser and desktop demo descriptions.
- Expand API, theme, integration, and lifecycle documentation and update demo links to quilt-layouts.vercel.app.

## 0.2.0

- Preserve React provider context through portals and update renderer options without rebuilding pane views.
- Add transactional asynchronous popout completion, explicit pane retry, and temporary-popout workspace JSON export/import.
- Add unified pane registration, scoped configurable shortcuts, typed message overrides, and workspace popout availability.
- Add opt-in close confirmation with a built-in dialog or an application-owned asynchronous replacement.
- Resolve geometry theme lengths through CSS, expose theme refresh/token mapping, and scope chrome resets to library elements.
- Add integration examples and regression coverage; isolate the browser test server from running demos.
- Add standalone vanilla, React, and Electron starters, typed application state, compile-time registration exclusivity, and explicit option resets.

## 0.1.1

- Keep pane action menus and submenus inside the viewport, including near window edges and during resizing. Oversized menus scroll so every action remains accessible.
- Add stylesheet export declarations for TypeScript 7 and checked side-effect imports, with packed-consumer coverage for TypeScript 5.9 and 7 and React 18.3 and 19.
- Update the README with a workspace settings overview, screenshots, and the recorded demo walkthrough.
- Upgrade the build and test toolchain and GitHub Actions, and validate downloaded release artifacts before publication.

## 0.1.0

Initial public release of Quilt:

- Framework-independent layout model, validation, commands, and subscriptions in `quilt-core`.
- Split panes, tabs, themes, and same-origin popouts in `quilt-vanilla`.
- React 18.3 and 19 components and hooks in `quilt-react`.
- ESM exports, TypeScript declarations, and adapter stylesheet entry points.
