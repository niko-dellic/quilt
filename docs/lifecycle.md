# Pane and window lifecycle

## A single owner, multiple views

A pane registry maps `type` strings to synchronous mount functions that return a view object or nothing:

```ts
(context: PaneContext) => {
  dispose(): void;
  ready?: Promise<void>; // optional framework commit acknowledgement
  resize?(width: number, height: number): void;
  update?(pane: Pane): void;
}
```

`context` contains `element`, `document`, `window`, `pane`, `state`, `reportError`, and `location` (`main` or `popout`). Use the supplied document/window for DOM creation, timers, event listeners, canvas contexts, portals, and computed styles. The element may initially be detached; use `resize` or ResizeObserver for measurements.

Register view-owned resources with `context.onCleanup(callback)` as you allocate them. Quilt runs these callbacks in reverse order even when mounting fails before returning. `context.signal` is aborted before cleanup on view teardown. Late cleanup registrations run immediately. Returned `dispose()` is still supported; exceptions are reported without preventing other cleanup, replacement, or window closure. Handle asynchronous data loading inside the view with a loading/error state; returning a Promise is not supported.

In the main document, stable pane IDs retain their view across resizing, tab activation, movement, and maximize/restore. Inactive tabs stay mounted and hidden. Changes to type or params remount that pane. Hiding or moving a view within its document does not abort its signal. Metadata changes call `update` when provided. Data changes should flow through application-owned subscriptions, not repeated layout JSON updates.

## Popout transaction

1. A user action calls `mounted.popout(id)`. The call opens the window synchronously and returns `Promise<boolean>` for completion.
2. The browser opens a blank same-origin window. Blocking leaves the original pane untouched and emits an error.
3. The library copies head stylesheet elements and basic document theme attributes, then runs `prepareWindow`.
4. The destination view mounts against the same application-owned state. It briefly coexists with the old view; avoid exclusive singleton resources during mounting.
5. If supplied, the destination view’s `ready` promise must resolve. Rejection, closure, or disposal cancels the attempt. Only successful mounting commits the detached placement and disposes the old view. A failed mount closes the destination and preserves the original placement/view.
6. A Return action or detected window close restores the pane. The old group is preferred; if constraints no longer permit it, a compatible group or new region is used. Returning also exits maximize mode so the pane is discoverable.

Popouts contain one pane. They cannot form separate split/tab workspaces in v1. Use Return before moving a popped-out pane elsewhere.

Application-owned data must be updated continuously. An input value or React `useState` living only inside the old view will not survive remounting. Map engines should place document/history state outside the renderer and explicitly release graphics resources. A simulated job belongs to the application's job owner, not a pane's lifetime.

## Browser behavior

Window opening requires a user gesture. Requested size/position can be adjusted by the browser and OS; some environments may open a tab. Placement JSON stores requested geometry, not continuous tracking of OS window movement. Access to multiple monitors is not requested.

Loading JSON never attempts unsolicited window creation. Detached records without live window handles dock into the main layout. Popouts are session-only: `exportWorkspace()` saves a docked copy and retains no reopening intent. Raw core exports still describe live state.

Quilt owns the mounted workspace store. Vanilla callers dispose the workspace once; React unmount handles disposal automatically. Supplied stores are rejected. The main window owns the session. Explicit disposal closes companions, releases mounts, and marks accessible orphan documents disconnected. Page departure attempts the same teardown. Close polling supplements `pagehide` detection. Browser crashes, mobile termination, or lost processes do not guarantee unload callbacks; this library is not a durable state store.

The default companion starts at `about:blank` and inherits the opener origin. A custom window factory must return a same-origin document synchronously. Cross-origin navigation is unsupported and triggers return/cleanup when access is lost. Do not request `noopener`: this architecture intentionally requires an opener-owned session.

## Styles and React providers

Linked styles and inline style elements are copied into companions and refreshed when the source head changes. Document/body class, style, and data attributes are synchronized. Ancestor-specific selectors, shadow-root styles, adopted stylesheets, and assets initialized by scripts need application integration through `prepareWindow` or pane wrappers.

Declarative React panes use portals and inherit their application providers, including in companion documents. Callback and component-map identity changes update options without rebuilding the workspace. Initial configuration is mount-only; changing the React key replaces the session. Standalone `reactRenderer` still creates an independent root and needs explicit provider wrappers. Document transitions still remount content; React-local state does not travel.

Close confirmation is opt-in through pane `confirmClose` or a unified registration default. Quilt supplies a dialog; `confirmClose(request)` can replace it with an application-owned asynchronous dialog. Capability `close: false` still prevents user closes. Explicit core commands bypass confirmation. Closing a popout returns the pane rather than discarding its application data.

## Corner gestures and pending content

Corner dragging previews the new region using the same constraint allocation as the renderer. The dominant drag axis chooses split orientation. A gesture across adjacent regions in the same row or column outlines the contiguous range and labels the region under the pointer as the receiver. This works across nested splits along the same axis; perpendicular splits are barriers. Dragging farther includes intermediate regions, and dragging back shrinks the range. Joining retains all selected content as tabs in the receiver, preserving its ID, active tab, and tab settings. Measured extents retain surrounding sizes, subject to content constraints. Every selected pane must permit joining. A layout change during a gesture cancels it. Escape and pointer cancellation remove the preview without changing state.

Releasing a split creates an empty group before opening a centered registry chooser. Empty regions can also be split repeatedly, even when the entire layout has no content. Without a registry, splitting an empty region simply creates another empty region. Choosing content adds it to that stable group ID. With the default `autoCollapse: "disabled"`, clicking outside the empty region dismisses its chooser without removing the region. Click the diagonal empty surface to reopen search. Escape releases search focus. Multiple pending regions can coexist; select content later or use the empty tab bar’s “Close empty pane” button. With `"enabled"` or `"protected"`, cancelling removes only the still-empty new group, preserving unrelated edits. Empty groups are valid JSON and provide a chooser if restored after a reload. Applications can use `workspace.splitGroup(groupId, axis, null, options)` and `workspace.removeEmptyGroup(groupId)` for the same workflow; filled groups are never removed by the latter.

## Automatic collapse

Use `workspace.setAutoCollapse('disabled')` on a mounted workspace, or supply a saved setting through `initialWorkspace`. Standalone core users can configure `new LayoutStore(layout, { autoCollapse: 'disabled' })`.
`AutoCollapse` accepts `'enabled' | 'protected' | 'disabled'`; omitted means `'disabled'`.
Read or change it with `workspace.getAutoCollapse()` and `workspace.setAutoCollapse(mode)`.
This is a workspace-wide session setting shared by DOM and React. Raw core layout JSON excludes it, and core `load` and `reset` preserve it.
Workspace presets include it; `loadWorkspace` applies the saved setting. The demo
Theming pane includes a live selector.

- `enabled`: closing, moving, or popping out the last tab removes its empty source region.
- `protected`: closing or moving the last tab removes the region; popping it out preserves it.
- `disabled`: all three operations preserve the empty region, its ID, and its placement.

Only the region emptied by an action is eligible for automatic removal. Switching modes
never prunes existing empty regions. To retain the previous automatic behavior, opt into
`enabled`. Empty tab bars provide “Close empty pane”; the final root cannot be removed.
Removing a region never deletes its detached content. Returning popouts prefer the preserved
original region, or use the existing fallback placement if it was explicitly removed.

## Restoring closed tabs

`workspace.restoreClosedPane()` restores the latest closed tab, preferring its original
region and index. If the region was removed, it uses the same compatible-region
fallback as returning a popout. It preserves subsequent layout edits and the tab's
ID and metadata. `workspace.canRestoreClosedPane()` reports whether a tab is available.
History retains up to 50 closed tabs for the store session, is excluded from JSON,
and clears on successful load/reset or disposal. Failed closes add no history.
Closing still disposes the view; restoration mounts it again. Application data
remains application-owned and must be retained outside view lifetimes.

Pane actions include **Close active tab** and **Restore closed tab**. Both demos
bind **R** to restore; the renderer enables this with `shortcuts: true` or
`shortcuts: { restoreClosedTab: true }`. Typing, modifier combinations, held keys,
and open dialogs do not trigger the shortcut.

**Close pane** closes all docked tabs in the region and removes the region,
independently of automatic-collapse settings. `workspace.closeGroup(groupId, options)`
performs this atomically, checking permissions and confirmation unless `{ force: true }` is explicitly supplied.
The last region remains empty so the workspace can accept new tabs. Closed tabs
remain individually restorable; detached companion tabs are not closed.

## Registering view cleanup

```ts
const render: PaneRenderer = ({ element, document: doc, signal, onCleanup }) => {
  const input = doc.createElement('input');
  input.addEventListener('input', () => saveDraft(input.value), { signal });
  element.append(input);
  const editor = createEditor(element);
  onCleanup(() => editor.destroy());
  // No return value is required for a simple view.
};
```

Cleanup runs once per mounted view, including failed companion attempts. Keep
application data and application-wide jobs outside this scope. React components
should still use ordinary effect cleanup for effect-owned resources; the context
scope lasts for the whole pane view, not each React effect execution.
