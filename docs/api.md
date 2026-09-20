# Configuration and API

This guide explains behavior and constraints. The [generated API reference](api-reference/index.md)
lists the current public signatures for Core, Vanilla, and React.

## Workspace API

Start with `new Workspace({ container, paneTypes })` in vanilla or `<Workspace paneTypes={...} />`
in React. The library creates and owns the model. A container needs an explicit usable height.
See the [vanilla quickstart](quickstart-vanilla.md) and [React quickstart](quickstart-react.md).

| Operation                                              | Behavior                                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `addPane(type, options?)`                              | Create from registered metadata; returns a pane handle, or `undefined` if its factory cancels |
| `getPane(id)` / `getPanes()`                           | Retrieve handles for existing panes, including restored panes                                 |
| `getLayout()` / `exportLayout()`                       | Stable immutable snapshot / mutable JSON copy                                                 |
| `loadLayout(input)`                                    | Validate and replace arrangement, docking detached records                                    |
| `exportWorkspace()` / `loadWorkspace(input)`           | Save/restore arrangement and appearance as parsed JSON objects                                |
| `reset()`                                              | Restore the initial workspace configuration                                                   |
| `on('change', listener)`                               | Subscribe to layout, theme, tab-bar, and auto-collapse changes; returns unsubscribe           |
| `on('error', listener)`                                | Subscribe to renderer/model errors; returns unsubscribe                                       |
| `closePane(id, options?)` / `closeGroup(id, options?)` | Asynchronous confirmation and permission checks; explicit `force: true` bypasses both         |
| `dispose()`                                            | Release views, windows, listeners, dialogs, and the internal model                            |

The remaining direct commands cover `activatePane`, `movePane`, `updatePane`, `splitGroup`,
`joinGroup`, `joinGroups`, `removeEmptyGroup`, `resize`, `resizeMany`, `maximize`,
`setTabDisplay`, `setTabPlacement`, `canRestoreClosedPane`, and `restoreClosedPane`.
`insertPane(record, groupId)` is an advanced alternative for fully specified pane records.
These explicit application commands retain core command validation and authority;
only close commands add confirmation by default. Browser popouts always respect availability and permissions.

`paneTypes` maps type names to `{ title, render, ...metadata }`. In React, `render` is a
component. Optional `create` factories return partial pane metadata or `undefined` to cancel.
`addPane` overrides factory metadata with explicitly supplied options, generates an ID if
omitted, and uses the last active docked group or the first group. Explicit `groupId` and
constraint failures never silently fall back to another group.

A pane handle has `id`, `isDisposed`, `getSnapshot()`, `update(patch)`, `setTitle(title)`,
`activate()`, `move(groupId, position?, index?)`, `popout(placement?)`, `return()`, `retry()`,
and `close(options?)`. It survives view remounts and document transitions. Removal or a
successful layout/workspace load invalidates it. Reacquire handles after loading or restoring
closed panes. Stale synchronous operations throw; asynchronous operations reject.

Change events contain `{ action, changes }`, where `changes` lists `layout`, `theme`,
`tabBar`, and/or `autoCollapse`. A workspace load emits one consolidated event. Failed and
cancelled changes emit none. Appearance-only events do not change the layout snapshot identity.
Use `exportWorkspace()` inside a debounced save listener; subscriptions end on disposal.

## Core layout JSON v1

```ts
interface Layout {
  version: 1;
  root: Group | Split;
  panes: Record<string, Pane>;
  popouts: Popout[];
  maximized: string | null; // group id
}
interface Group {
  kind: 'group';
  id: string;
  panes: string[];
  active: string | null;
  tabPlacement?: 'top' | 'left';
  tabDisplay?: 'automatic' | 'compact';
}
interface Split {
  kind: 'split';
  id: string;
  axis: 'horizontal' | 'vertical';
  gap?: number; // pixels; defaults to 4
  ratio: number; // preferred share of the first child, strictly between 0 and 1
  children: [Group | Split, Group | Split];
}
interface Pane {
  id: string;
  type: string;
  title: string;
  icon?: string; // application icon key
  params?: Json; // JSON only, not runtime state
  header?: boolean;
  confirmClose?: boolean; // optional UI confirmation; default inherits registration or false
  capabilities?: Partial<
    Record<'resize' | 'move' | 'split' | 'join' | 'close' | 'popout', boolean>
  >;
  size?: { minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number };
}
interface Popout {
  paneId: string;
  groupId: string;
  index: number; // desired return location
  placement?: { width?: number; height?: number; left?: number; top?: number };
}
```

The `version`, `root`, `panes`, `popouts`, and `maximized` properties are required. Node IDs are unique across the tree; pane IDs are unique in their dictionary. Every pane appears exactly once, either in a group or the popout list. Empty groups have `active: null`. Maximum nesting depth is 64. JSON cannot contain cycles, functions, undefined values, nonfinite numbers, or class instances.

Sizes refer to the full pane region, including chrome. Defaults are minimum zero and no maximum. Tab groups satisfy the intersection of their panes' constraints, so incompatible tabs are rejected. Split children may leave unused space when a maximum prevents them filling the cross axis. A four-pixel divider (overridable with `Split.gap`) contributes to recursive minimum sizes. Below the combined minimum, the workspace scrolls. Above combined maximums, surplus space stays empty. Split ratios are preferences constrained by these limits, not guaranteed pixel proportions.

Capability flags default to true. Group-level operations require permission from affected panes: resizing a split checks both subtrees; tabbing and moving check the dragged pane and destination group; splitting checks the destination; joining checks the sibling region. Fixed bars normally disable all capabilities as well as specify size bounds. Host code can still deliberately reposition them.

## Advanced browser-free core exports

`createLayout(options?: { pane?: Pane; groupId?: string }): Layout` creates validated,
cloned JSON v1. With no pane it creates an empty group; otherwise it activates the supplied
pane. The group defaults to `main`; supplied IDs are preserved. Invalid inputs throw
`LayoutError`. Results have no popouts or maximized region and share no mutable data with inputs.

Both adapter entry points re-export `LayoutError`, `createLayout`,
`parseLayout`, `validate`, and core types. The model type is named `LayoutSnapshot`
in adapters to distinguish it from React's `Workspace` component. React also exports
`TabRegistry`, `themes`, `themeFamilies`, and public DOM options/view/handle types.
See [migration notes](migration.md) for removed pre-release APIs.

`parseLayout(unknown): Layout` clones and validates or throws `LayoutError`. `validate(unknown): Issue[]` returns `{path, message}` issues. `bounds`, `allocate`, `groups`, `paneIds`, `findNode`, and `findParent` are pure helpers.

`new LayoutStore(input, options?)` creates a single state owner. The optional
`LayoutStoreOptions.autoCollapse` accepts `AutoCollapse` (`'enabled' | 'protected' | 'disabled'`),
defaulting to `'disabled'`. `getAutoCollapse()` reads the session setting and
`setAutoCollapse(mode)` validates and updates it without altering the current layout.
Core load/reset preserve this setting; raw layout JSON excludes it.
Workspace presets serialize it, and `loadWorkspace` applies the saved setting. Enabled collapses regions emptied
by close, move, or popout; protected exempts popouts; disabled preserves all empty source
regions. Use `removeEmptyGroup(groupId)` or the empty tab bar’s X to explicitly remove
an empty region (except the final root).

Commands clone, validate, and commit atomically. A failed command leaves the previous snapshot intact and reports to `onError` subscribers before throwing.

| Method                                               | Behavior                                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `getSnapshot()`                                      | Stable, deeply frozen snapshot; treat it as read-only                                                                             |
| `export()`                                           | Mutable clone suitable for JSON serialization                                                                                     |
| `subscribe(listener)`                                | Observe `{action, layout}`; returns unsubscribe                                                                                   |
| `onError(listener)`                                  | Observe command/subscriber failures; returns unsubscribe                                                                          |
| `load(input)`                                        | Replace with validated JSON atomically                                                                                            |
| `reset()`                                            | Restore constructor configuration                                                                                                 |
| `activate(groupId, paneId)`                          | Select an existing tab                                                                                                            |
| `add(pane, groupId, options?)`                       | Insert a new pane as a tab                                                                                                        |
| `updatePane(pane)`                                   | Replace metadata/constraints with validation                                                                                      |
| `split(groupId, axis, newPane, options?)`            | Create a new region after the existing group                                                                                      |
| `joinRegions(receiverId, otherId, options?)`         | Join the inclusive contiguous row/column range into the receiver, crossing same-axis split ancestry; preserve all content as tabs |
| `join(groupId, options?)`                            | Collapse its parent split, retaining all sibling content as tabs                                                                  |
| `move(paneId, groupId, position?, index?, options?)` | Position is `tab`, `left`, `right`, `top`, or `bottom`; index is a tab insertion index after detachment                           |
| `resize(splitId, ratio, options?)`                   | Set a preferred split proportion                                                                                                  |
| `resizeMany(ratios, options?)`                       | Atomically update a map of split IDs to preferred proportions                                                                     |
| `maximize(groupId \| null)`                          | Maximize or restore a region                                                                                                      |
| `close(paneId, options?)`                            | Remove pane and placement                                                                                                         |
| `popout(paneId, placement?, options?)`               | Pure model transition; does not open a browser                                                                                    |
| `returnPane(paneId)`                                 | Return to a compatible original/fallback group, or a new region                                                                   |
| `setTabPlacement(groupId, placement?)`               | Set top/left orientation; omit to inherit                                                                                         |
| `setTabDisplay(groupId, display?)`                   | Set automatic/compact display; omit to inherit                                                                                    |
| `removeEmptyGroup(groupId)`                          | Remove an empty region except the final root                                                                                      |
| `closeGroup(groupId, options?)`                      | Atomically close docked tabs in a region                                                                                          |
| `canRestoreClosedTab()`                              | Report whether closed-tab history is available                                                                                    |
| `restoreClosedTab()`                                 | Restore the most recently closed tab with compatible placement                                                                    |
| `dispose()`                                          | End subscriptions; idempotent; subsequent commands fail                                                                           |

Options accept `{source: 'user' | 'api'}`; default is `api`. Flags only restrict `user` commands. Use the mounted renderer's `popout` method, not the store's pure `popout` command, to open browser windows. A DOM renderer interprets detached records without live companion handles as restored data and docks them without retaining reopening intent.

## DOM exports

`new Workspace({ container, ...options })` appends its own scoped root; it does not clear unrelated host content. Options:

- `initialLayout` or `initialWorkspace`: optional, mutually exclusive initial configuration. Omit both for an empty workspace. A preset supplies its saved theme, tab bar, and auto-collapse setting, taking precedence over initial appearance options. Quilt owns the store; external `store` input is rejected.
- `renderers`: pane-type-to-renderer registry.
- `getPaneState(id)`: optional application-owned reference for each view mount.
- `tabs`: `TabRegistry` of available content. Factories return pane metadata, or undefined to cancel. Omitted instance IDs are generated.
- `registry`: combines creation metadata and renderers; mutually exclusive with `tabs` and `renderers`.
- `messages`: typed text overrides for chrome and dialogs.
- `shortcuts`: opt-in presets or explicit key/modifier bindings.
- `popouts`: workspace-level availability, default true.
- `confirmClose(request)`: optional application dialog replacing the built-in close confirmation.
- `renderIcon(key, document)`: optional icon resolver.
- `theme` and `tabBar`: theme tokens and workspace/group tab-bar configuration; see [Theming](theming.md).
- `onError(error)`: mount, interaction, and window failures.
- `prepareWindow(window, pane)`: copy additional application styles/assets into a companion document.
- `openWindow(pane, placement)`: optional synchronous, same-origin window factory; null means blocked. The library owns this returned window and replaces its body, so do not return an existing unrelated application window.

The workspace additionally provides:

| Method                                     | Purpose                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `updateOptions(partial)`                   | Update options in place; omitted keys remain unchanged, explicit `undefined` resets them |
| `setTheme(theme)`                          | Replace theme overrides; `{}` clears them                                                |
| `setTabBar(options)`                       | Replace tab-bar settings; `{}` restores defaults                                         |
| `refreshTheme()`                           | Recompute CSS geometry and synchronize companions                                        |
| `exportWorkspace()`                        | Export layout and appearance with a docked layout copy                                   |
| `loadWorkspace(input)`                     | Validate and apply a workspace preset                                                    |
| `popout(id, placement?): Promise<boolean>` | Open a companion from a user action; resolve when mounting succeeds or fails             |
| `returnPane(id)`                           | Dock a live companion pane                                                               |
| `retryPane(id)`                            | Retry a failed view                                                                      |
| `closePane(id) / closeGroup(id)`           | Request pane or group closure, including confirmation when configured                    |
| `dispose()`                                | Release views, listeners, dialogs, companions, and the owned store                       |

Call `workspace.dispose()` once to release its resources. There is no public store property.

## React exports

`Workspace` accepts the same options except `container` (it creates its own host), replacing `renderers` with `components: Record<string, ComponentType<PaneProps>>`, plus `className` and `style`. Its ref exposes the mounted handle. Use `onReady(handle)` for initialization. Before readiness, synchronous methods throw `Workspace is not ready`; asynchronous methods reject with the same error. React owns disposal on unmount. Initial configuration changes do not reset the session.

`reactRenderer(Component)` adapts a React component for mixed vanilla/React consumers. `useLayoutSnapshot(workspace)` subscribes with React's external-store API. React 18.3 and 19 are peer-compatible; packed-consumer tests compile and exercise both React versions.

`PaneProps<State>` includes `document`, `window`, `pane`, `state`, `reportError`, `signal`, `onCleanup`, and `location`; the vanilla `PaneContext<State>` also receives `element`. State defaults to `unknown`. See [typed state and option resets](integration.md#typescript-state-and-option-resets).

## Theme variables

Override `.layouts` variables in your application stylesheet: `--layouts-bg`, `--layouts-panel`, `--layouts-header`, `--layouts-text`, `--layouts-muted`, `--layouts-line`, `--layouts-accent`, `--layouts-focus`, and `--layouts-radius`. Styling remains scoped; application content is yours. No OS-dependent motion overrides are installed.

## Tab icons and shortcuts

`Pane.icon?: string` is an optional, serializable application key. Supply
`renderIcon(key, document)` to the vanilla mount options or React `<Workspace>`.
Return a fresh decorative DOM element, or `undefined` for an unknown key.
The library falls back to the first character of the title, keeps the full title
as the accessible name and tooltip, and never interprets icon keys as markup.
The demos use a small Lucide registry; consumers can use any icon library without
adding Lucide to their production dependencies. See `demos/icons.ts`.

Tabs shrink according to their own available width. Below 130px per tab, only
the active tab keeps its close button; below 95px, labels hide and icons remain.
If even icon tabs cannot fit, the strip scrolls. Drag to either half of another
tab to insert before or after it, including within the same pane region.
Closing respects `capabilities.close`; locked tabs have no close button.

Convenience shortcuts are disabled by default:

```ts
new Workspace({
  container: host,
  initialLayout,
  renderers,
  shortcuts: true, // enable all conveniences
});
// Or select individually:
// shortcuts: { maximize: true, middleClickClose: false, addTab: true }
```

Backtick (`` ` ``) or Option+Space (`Alt+Space`) toggles workspace maximize/restore for the hovered
pane region, falling back to the keyboard-focused region. This fills the layout
host; it does not invoke the browser Fullscreen API. Text inputs, editable
content, dialogs, and repeated key events are left alone. Some operating systems
reserve Alt+Space and may intercept it before the page receives it; the actions
menu remains available. Middle-click closes a tab when enabled and permitted.
`T` opens the new-tab picker in the hovered region when registered tabs and
its move capabilities allow adding a tab. Handled events call `preventDefault()`.
The typing, dialog, and repeat safeguards also apply. Use T without modifiers.
Normal tab arrow-key navigation and divider keyboard resizing remain available
regardless of this convenience setting.

## Register available tabs

A `TabRegistry` describes what users can create; the layout snapshot describes
what is already open. Registering a type does not mount it. Removing a
registration prevents new instances without closing existing panes.

```ts
import { TabRegistry, Workspace } from 'quilt-vanilla';
const tabs = new TabRegistry();
const unregister = tabs.register({
  id: 'canvas',
  title: 'Canvas',
  description: 'Interactive scene viewport',
  icon: 'canvas',
  keywords: ['scene', 'viewport', '3d'],
  create: ({ source, groupId }) => ({
    id: crypto.randomUUID(),
    type: 'canvas', // corresponding renderer/component registry key
    title: 'Scene',
    icon: 'canvas',
  }),
});
const workspace = new Workspace({ container: host, initialLayout, renderers, tabs });
// unregister(); // also updates a currently open picker
```

`new TabRegistry(entries)` accepts an initial array. `register` rejects duplicate
or empty IDs and returns an idempotent unregister function. `list()` returns
registrations in insertion order; `subscribe(listener)` returns cleanup.
Registration IDs identify choices; pane IDs identify individual open instances.
Factories supply type, metadata, constraints, and initial params. IDs are optional;
Quilt generates omitted IDs once per creation and preserves explicit IDs. Return
`undefined` to cancel. They run only after an explicit selection. Core validation
remains atomic, so a rejected creation preserves the workspace.

Add tab and split actions open a searchable combobox tray. Search matches titles,
descriptions, and keywords. Arrow keys move selection, Enter creates, and Escape
cancels modal choosers. With autoCollapse disabled, clicking outside a new split’s region dismisses its chooser while preserving the empty region.
Click its empty surface to reopen search, or close the region explicitly. Add tab activates the new tab in the same region. Split creates a new
region containing the selected type. Canvas is an ordinary pane renderer and can
be added, tabbed, dragged, closed, maximized, and popped out under the same rules.

Pass `tabs` to React `<Workspace>` too. Keep the registry object stable and register
or unregister entries as features mount or unmount. Content creation uses registered choices; the legacy `createPane` callback has been removed. Empty regions can still split into empty regions without a registry. Existing movement/split capability checks still
apply. See [Theming](theming.md) for the separate theme API.

Menu actions include built-in decorative icons. The optional `renderIcon` resolver
can override them using `layouts:add-tab`, `layouts:split-right`,
`layouts:split-below`, `layouts:join`, `layouts:maximize`, `layouts:restore`,
`layouts:popout`, `layouts:close`, and `layouts:cancel`. Return `undefined` to use
the built-in icon. Icons inherit text color, including disabled and themed states.

Interactive divider resizing preserves distant pane boundaries. Only branches
touching the divider absorb the size change, stopping at their minimum or maximum
sizes. The DOM renderer computes the coupled ratios and commits them through
`resizeMany`; React shares this behavior. `resize` remains a low-level proportional
command. Resizing the whole workspace still uses the stored proportions.

Empty regions display diagonal guide lines. Click the empty content area, or focus it
and press Enter/Space, to open tab search. Registry factories receive `source: undefined`
when the workspace has no remaining source pane.

`joinRegions` accepts `JoinOptions`: capability handling matches other commands. Optional
`extents` maps every node ID in the affected row/column (including splits) to its rendered
size along the join axis. The DOM renderer supplies these measurements to preserve actual
sizes under constraints and custom divider widths. Without measurements, the command
preserves proportional shares. `joinRange(root, from, to)` returns the eligible range for
previews, or `undefined` when endpoints are identical, absent, or separated by a perpendicular
split. Content constraints and capabilities are validated atomically when committing.
The existing `join` command and “Join sibling region” menu retain their parent-collapse behavior.

## Workspace presets and interaction options

`WorkspacePreset` v1 stores layout, theme, tabBar, and autoCollapse. The exported
layout is docked without changing live windows. `parseWorkspace` validates an
independent preset; `dockLayout` normalizes a layout copy. Raw core exports retain
live detached records.

`registry: PaneRegistry<PaneRenderer>` replaces separate `renderers` and `tabs`
when supplied. React accepts `PaneRegistry<ComponentType<PaneProps>>`. Registrations
combine `type`, `title`, `view`, optional `create`, and optional `confirmClose`.

Options add `messages`, `popouts` (default true), and an optional async
`confirmClose(request)` replacement for the built-in dialog. Confirmation is
only requested for panes opting in through metadata or their registration.
`KeyBinding` accepts `key` and optional `ctrl`, `alt`, `shift`, `meta`; configurable
shortcut actions accept one binding, an array, or their existing boolean preset.

See [Web integration](integration.md) for complete usage and lifetime rules.
