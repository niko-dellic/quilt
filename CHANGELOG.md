# Changelog

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
