# API migration

## Workspace-first API in 0.3.0

- Replace `mountLayout(host, options)` with `new Workspace({ container: host, ...options })`.
- Rename React `<Layout>` to `<Workspace>`, `LayoutProps` to `WorkspaceProps`, and
  `MountedLayout` to `WorkspaceHandle`. No compatibility aliases remain.
- Remove mounted store construction/injection and manual store disposal. Call
  `workspace.dispose()` in vanilla; unmount in React. Import standalone `LayoutStore`
  from `quilt-core` only for browser-free model work.
- Replace `workspace.store.getSnapshot()` with `workspace.getLayout()`, `export()` with
  `exportLayout()`, `load()` with `loadLayout()`, and `subscribe(fn)` with `on('change', fn)`.
- Replace model `add` with `insertPane`, `move` with `movePane`, `split` with `splitGroup`,
  `join` with `joinGroup`, `joinRegions` with `joinGroups`, and `activate(group, id)` with
  `activatePane(id)`. Prefer `addPane(type, options)` and returned pane handles for new code.
- Replace `restoreClosedTab` / `canRestoreClosedTab` with `restoreClosedPane` /
  `canRestoreClosedPane`. Pass the workspace itself to `useLayoutSnapshot`.
- `workspace.reset()` restores the entire initial workspace, including appearance and auto-collapse. Use `loadLayout(initialLayout)` to replace only the arrangement.
- Replace `requestClose(id)` with `closePane(id)` and group requests with `closeGroup(id)`.
  Programmatic closes now honor confirmation and permissions. Use `{ force: true }`
  only for explicit application authority.
- Use plain `paneTypes` for ordinary registration. Advanced registry APIs remain available,
  but cannot be combined with `paneTypes` on the same mount.
- Reacquire pane handles after successful load/reset or closed-pane restoration. IDs persist;
  handles to removed or replaced panes do not become valid again.

## 0.3.0: one owned workspace lifecycle

- Remove store construction from vanilla/React mount setup. Pass layout JSON as
  `initialLayout`, or a saved preset as `initialWorkspace`; omit both for an empty workspace.
- Remove `store` from mount options and React props. It is rejected at runtime and
  by TypeScript. There is no ownership compatibility switch.
- Access commands and subscriptions directly through the workspace. Vanilla calls only
  `workspace.dispose()`; React unmount releases its renderer and store automatically.
- Remove manual store disposal and user-side microtasks. Use `onReady(handle)` to
  connect React controls after initialization.
- Initial configuration is consumed once. Use commands or `loadWorkspace()` for
  later changes, or change the React key to create a new session.
- Early asynchronous React ref calls reject instead of resolving false;
  synchronous calls throw the same `Workspace is not ready` error.
- Pane renderers can use `signal` and register `onCleanup` callbacks immediately
  after resource allocation. Simple renderers can return nothing. Direct callers
  of `PaneRenderer` must handle a void result and supply the new context fields.
- Standalone `LayoutStore` remains supported for model-only consumers. Application
  data ownership and JSON schema versions are unchanged.

The sections below describe previous releases.

## 0.1.x → 0.2.0 upgrade checklist

1. Upgrade all installed Quilt packages to **0.2.0** together and rebuild.
2. Keep the adapter stylesheet import (`quilt-vanilla/styles.css` or
   `quilt-react/styles.css`), and give the host a definite height.
3. Choose either `registry` or the separate `tabs` and
   `renderers`/`components` maps. TypeScript now rejects mixing them.
4. Await popout completion and move durable pane data outside component/view state.
5. Use workspace JSON for complete settings; keep application data and CSS assets
   in application storage. Existing raw layouts can still use core `store.load`.
6. Review pane-content CSS and opt into close confirmation where desired.
7. Smoke-test save/load, theme switching, and popout return in your host.

### Behavior and API details

- Await `mounted.popout(id)` for its `Promise<boolean>` result. Call it directly
  inside the user gesture; do not await preparation before opening.
- Declarative `<Workspace>` panes now inherit React providers. Remove duplicate
  provider wrappers where appropriate. Standalone `reactRenderer` retains its
  separate-root contract. Cross-document local state still remounts.
- Ordinary callback and component-map identity changes no longer rebuild the
  workspace. Changing the React key replaces the session.
- Use `exportWorkspace()`/`loadWorkspace()` for layout and appearance together.
  Core `store.export()` remains the raw live model. Workspace exports dock copies;
  imported popouts no longer advertise a pending “Reopen window” action.
- Quilt's reset, focus and scrollbar rules now target its own chrome. Applications
  wanting the same rules inside pane content should opt in through their CSS.
- Geometry theme tokens accept CSS lengths. Use `refreshTheme()` after CSSOM or
  media-query changes; avoid clearing overrides merely to trigger a refresh.
- Close confirmation is opt-in (`Pane.confirmClose` or a registered default).
  Explicit core commands continue to bypass UI confirmation.
- Workspace JSON is a new envelope; existing layout JSON remains valid for
  `store.load`. The demos accept both and export the complete envelope.

See [integration examples](integration.md). All three packages use version 0.2.0.

## Earlier pre-release migration

The library is now named **Quilt**. Update dependencies and imports together:

| Previous package | New package     |
| ---------------- | --------------- |
| `layouts-core`   | `quilt-core`    |
| `layouts`        | `quilt-vanilla` |
| `layouts-react`  | `quilt-react`   |

Stylesheet imports are now `quilt-vanilla/styles.css` or `quilt-react/styles.css`.
The first npm release is `0.1.0`. The existing `.layouts`
CSS classes, `--layouts-*` theme variables, and `layouts:*` icon keys remain
unchanged, so application styling and icon overrides continue to work. The GitHub
repository is now `niko-dellic/quilt`.

These source changes also break older development tarball APIs; do not replace a
released archive under the same version.

## Registered content replaces createPane

`LayoutOptions.createPane` and the corresponding React prop are removed. Register available content and pass the registry as `tabs` instead:

```ts
import { TabRegistry } from 'quilt-vanilla'; // also exported by quilt-react
const tabs = new TabRegistry([
  {
    id: 'notes',
    title: 'Notes',
    create: ({ source }) => ({
      id: crypto.randomUUID(),
      type: 'notes',
      title: source ? `${source.title} copy` : 'Notes',
    }),
  },
]);
// new Workspace({ container: host, initialLayout, renderers, tabs });
// <Workspace initialLayout={initialLayout} components={components} tabs={tabs} />
```

Return `undefined` to cancel. Source can be undefined in an empty workspace. Add-tab and populated-region content creation need registered choices. Empty regions can still split into empty regions without a registry. Programmatic `workspace.insertPane` and `workspace.splitGroup` remain available.

## Imports and initialization

Core's undocumented `isJson` and `paneBounds` exports are now private. Use `validate`/`parseLayout` for layout validation and `bounds` for region constraints. Documented core helpers, `joinRange`, and the shared `DIVIDER` constant remain public.

Both adapters export `LayoutError`, `createLayout`, `parseLayout`, `validate`, and core types. Import the model as `LayoutSnapshot` from adapters or `Layout` from core. React uses the `Workspace` component. React also re-exports the tab registry, theme presets, and public DOM types.

Use `new Workspace({ container })` for an empty mounted workspace, or `createLayout({ pane, groupId })` for a single pane. It clones and validates data, preserves IDs, and defaults the group ID to `main`.

React apps can import `quilt-react/styles.css` instead of `quilt-vanilla/styles.css`; both contain the same rules. No JSON migration is needed; layout version remains 1.
