# Web integration

Quilt owns arrangement and chrome. Applications own content, data, storage, and
jobs. No storage backend or framework is required by core.

## Plain pane types and handles

Use a plain map for ordinary registration; no registry object is necessary:

```ts
const workspace = new Workspace({
  container: host,
  paneTypes: { notes: { title: 'Notes', render: renderNotes, confirmClose: true } },
});
const notes = workspace.addPane('notes', { id: 'project-notes', title: 'Project notes' });
notes?.setTitle('Meeting notes');
// In a user gesture: await notes?.popout();
// await notes?.close(); honors permissions and optional confirmation.
```

React accepts the same map with a component as `render`. The map and callbacks may
change identity without replacing the workspace. Only changed renderer/component types
remount their affected views. `paneTypes` is mutually exclusive with `registry` and
separate `renderers`/`components`/`tabs` options. Clear the previous registration option
explicitly when switching registration forms through `updateOptions`.

`getPane(id)` retrieves handles for saved or UI-created panes. A handle remains valid
across movement and popouts but is invalidated by removal or successful load/reset.
Reacquire it after restoring a closed pane or loading JSON. `id` is the stable unique
identity; `title` is the changeable display label. Pane data remains application-owned.

## Unified registration

Vanilla can register a pane type and renderer together:

```ts
import { PaneRegistry, Workspace } from 'quilt-vanilla';
import type { PaneRenderer } from 'quilt-vanilla';
import 'quilt-vanilla/styles.css';

const registry = new PaneRegistry<PaneRenderer>([
  {
    type: 'notes',
    title: 'Notes',
    confirmClose: true,
    view: ({ element, document: doc }) => {
      const content = doc.createElement('p');
      content.textContent = 'Application content';
      element.append(content);
      return { dispose() {} };
    },
  },
]);
const workspace = new Workspace({ container: host, registry });
```

Selecting a type creates a pane with a generated ID. An optional `create(context)`
can return partial pane metadata, an explicit ID, or `undefined` to cancel.
Generated IDs are assigned once per creation. Duplicate explicit IDs fail core
validation. `register` returns an idempotent unregister function. Removing a type
removes its creation choice and uses the unknown-type placeholder for existing
instances; their IDs, metadata, and external data remain intact.

For React, use `PaneRegistry<ComponentType<PaneProps>>` and provide components as
`view`. Pass it to `<Workspace registry={registry} initialLayout={initialLayout} />`. Low-level
`tabs` plus `renderers`/`components` remain supported, but cannot be combined with
the unified registry on one mount.

## React providers and updates

```tsx
<YourApplicationProvider>
  <Workspace initialLayout={initialLayout} components={{ notes: Notes }} onError={reportError} />
</YourApplicationProvider>
```

Pane components inherit the surrounding providers. Inline maps/callbacks do not
remount them. Changing a component for one type remounts only that type. Initial configuration is consumed once. To start a new session, unmount and remount
`Workspace` (or change its React key). Standalone `reactRenderer`
creates its own root and requires a provider wrapper.

`updateOptions(partial)` updates vanilla renderers, registrations, callbacks,
messages, shortcuts, theme, and tab-bar options. Use `retryPane(id)` to retry a
failed pane without reloading the layout. `reportError(error)` in `PaneContext`
reports asynchronous renderer failures and marks the pane retryable.

Popout calls open the window before returning a promise:

```ts
button.onclick = async () => {
  const opened = await workspace.popout('notes');
  if (!opened) showStatus('The pane stayed in the workspace.');
};
```

Do not await unrelated work before calling `popout`; the browser requires user
activation. A renderer may return `ready: Promise<void>` to acknowledge its first
successful commit. Rejection preserves the source. Closing the destination or
disposing Quilt cancels pending opening. Cross-document moves remount views;
keep durable data outside local component state.

## Workspace JSON

```ts
const json = JSON.stringify(workspace.exportWorkspace(), null, 2);
workspace.loadWorkspace(JSON.parse(json));
```

`WorkspacePreset` v1 contains `version`, `layout`, `theme`, `tabBar`, and
`autoCollapse`. `parseWorkspace(unknown)` validates and returns an independent,
docked copy. Invalid input leaves the mounted workspace unchanged. Unknown pane
types remain in the layout with placeholders until their renderer is registered.

Popouts are temporary. Export docks a copy using compatible return locations,
without closing live windows. Import never opens windows and has no pending
reopen state. Raw `workspace.exportLayout()`/`getLayout()` remain available for the live
core model; these include actual detached records and exclude appearance.

Only configured theme overrides are serialized, not application stylesheets,
fonts, provider state, callbacks, or pane data. CSS variable references retain
their meaning when the importing application supplies the referenced variables.

### Optional application-owned localStorage

This example belongs in your app; Quilt does not read or write browser storage.
Restore before subscribing. Appearance changes should also call `scheduleSave`.

```ts
const key = 'editor-workspace';
try {
  const saved = localStorage.getItem(key);
  if (saved) workspace.loadWorkspace(JSON.parse(saved));
} catch (error) {
  reportError(error); // Keep the default workspace; leave the saved value intact.
}
let timer: ReturnType<typeof setTimeout> | undefined;
function flushSave() {
  clearTimeout(timer);
  timer = undefined;
  try {
    localStorage.setItem(key, JSON.stringify(workspace.exportWorkspace()));
  } catch (error) {
    reportError(error);
  }
}
function scheduleSave() {
  clearTimeout(timer);
  timer = setTimeout(flushSave, 250);
}
const unsubscribe = workspace.on('change', scheduleSave);
function dispose() {
  unsubscribe();
  flushSave();
  workspace.dispose();
}
```

Use explicit saves if saving every layout change is unsuitable. Network/file
storage can use the same JSON; applications decide concurrency and error policy.
No unload callback guarantees a durable final save.

## Custom themes

```css
.editor {
  --card: #20242b;
  --layouts-panel: var(--card);
  --layouts-resize-handle-width: calc(0.25rem + 2px);
}
```

```ts
workspace.setTheme({ panel: 'var(--card)', accent: '#82baff' });
const savedTheme = workspace.exportWorkspace().theme;
workspace.setTheme({}); // Remove inline overrides and inherit CSS again.
workspace.setTheme(savedTheme);
```

Quilt supports CSS lengths, including relative units and `calc()`, for measured
geometry. Host/ancestor style/class changes and head style text changes refresh
chrome automatically. Call `refreshTheme()` after stylesheet CSSOM edits or
media-query changes; it updates geometry and companion tokens. If you attach a
`matchMedia` listener, remove it when disposing your app.

Companions receive resolved Quilt tokens. Application variables/fonts/content
styles may need `prepareWindow`. See [theming](theming.md) for the public token
map and all supported tokens. Chrome resets and focus styles do not style your
pane's controls.

## Optional confirmation and localization

```ts
workspace.updatePane({ ...workspace.getLayout().panes.notes!, confirmClose: true });
workspace.updateOptions({
  messages: {
    'Close selected panes?': 'Close these documents?',
    Cancel: 'Keep open',
  },
});
```

Confirmation is disabled by default. Pane `confirmClose: true/false` overrides
its registered type's default. Only closes containing flagged panes prompt.
Group close prompts once and commits all affected panes together.

To replace the default dialog:

```ts
workspace.updateOptions({
  confirmClose: async ({ panes, requiringConfirmation, signal }) =>
    showYourDialog({ panes, requiringConfirmation, signal }),
});
```

Return `true` to approve or `false` to cancel. Rejection reports an error and
cancels. Respect the abort signal to dismiss your dialog when the workspace
changes or unmounts. Late approval cannot close stale targets. Direct core
commands are explicit application authority and bypass this UI policy.
Closing a companion simply docks its pane and does not prompt.

`defaultMessages` lists typed English message keys. Overrides support `{title}`,
`{count}`, and other named placeholders shown in each default. Messages are
plain text. Application pane titles and application errors remain app-owned.

## Shortcuts and host capabilities

```ts
workspace.updateOptions({
  shortcuts: {
    addTab: { key: 't', ctrl: true },
    restoreClosedTab: [
      { key: 'z', ctrl: true },
      { key: 'z', meta: true },
    ],
    maximize: true,
    middleClickClose: true,
  },
  popouts: false,
});
```

Bindings use `KeyboardEvent.key` with exact `ctrl`, `alt`, `shift`, and `meta`
booleans. Omitted modifiers are false. `true` selects the existing preset;
conveniences remain off by default. Focus selects the active workspace, with
hover as fallback. Within that workspace, the hovered region takes precedence
over the focused region. Editable content, composition, repeats, dialogs, and handled
events are ignored. Browser/OS-reserved shortcuts may not reach the page.

`popouts: false` hides the window action and prevents API opening. Individual
pane capabilities still apply. The [Electron hosts](compatibility.md#electron-reference-host) use the existing
same-origin window API. Tauri native-window adapters and dedicated bindings for
other frameworks are not included.

## TypeScript state and option resets

Use `PaneContext<NotesState>`, `PaneRenderer<NotesState>`, or
`PaneProps<NotesState>` to type application state. The default remains `unknown`.
Use `WorkspaceHandle<NotesState>` for an explicitly typed handle or React ref;
vanilla infers the handle state from its mount options. A typed layout requires a matching `getPaneState(id)`. The type describes the
state shared by its pane renderers; for heterogeneous panes use a discriminated
state union or per-pane application stores and narrow the union inside each view.

```tsx
type NotesState = { text: string };
function Notes({ state }: PaneProps<NotesState>) {
  return <p>{state.text}</p>;
}
<Workspace<NotesState>
  initialLayout={initialLayout}
  components={{ notes: Notes }}
  getPaneState={(id) => notesById.get(id)!}
/>;
```

`updateOptions` retains omitted keys. Explicit `undefined` restores defaults,
including under TypeScript's `exactOptionalPropertyTypes`:

```ts
workspace.updateOptions({
  theme: undefined,
  tabBar: undefined,
  messages: undefined,
  shortcuts: undefined,
  popouts: undefined,
  confirmClose: undefined,
});
workspace.updateOptions({ registry: undefined, renderers: myRenderers, tabs: myTabs });
```

Clearing a registry clears its derived creation and renderer maps. Existing pane
records remain, with placeholders until another renderer is supplied. Replacing
callbacks does not remount existing views. `getPaneState` is read at view creation;
existing views retain their supplied state reference. Keep that reference stable
and send data changes through your application's subscriptions. Removing
`prepareWindow` affects future companions; it cannot undo application resources
already installed in a document. The store itself is not an updateable option.

See the [runnable starters](https://github.com/niko-dellic/quilt/blob/main/examples/README.md) and
[host compatibility table](compatibility.md).

## Workspace ownership and readiness

Quilt creates one store per mounted workspace. Pass `initialLayout` or
`initialWorkspace`, never both; omit both for an empty workspace. A workspace
preset supplies its saved appearance and auto-collapse configuration, overriding
initial `theme`/`tabBar` options. Initial inputs are not controlled props: use
`workspace.loadWorkspace(preset)` or `workspace` commands for later changes.
Externally constructed stores are only for standalone core use.

Vanilla returns a ready handle synchronously. Call `workspace.dispose()` when
removing the host; it releases the renderer and store. React does this on unmount.
React exposes `onReady(handle)` for initialization and acquiring the workspace handle:

```tsx
<Workspace
  initialWorkspace={savedPreset}
  components={components}
  onReady={(workspace) => connectApplicationControls(workspace)}
/>
```

`onReady` runs once for each actual initialized session; changing its callback
alone does not re-run it. It signals workspace readiness, not completion of every
pane's asynchronous work. Before readiness, synchronous ref calls throw
`Workspace is not ready`, and asynchronous calls reject with that error. Popouts
are never queued: call them directly from a user gesture after readiness.

For immutable React data, read current values from application context instead
of returning a new object from `getPaneState` on every render:

```tsx
const NotesContext = createContext<Record<string, string>>({});
function Note({ pane }: PaneProps) {
  const notes = useContext(NotesContext);
  return <p>{notes[pane.id]}</p>;
}
function Editor({ notes }: { notes: Record<string, string> }) {
  return (
    <NotesContext.Provider value={notes}>
      <Workspace initialLayout={initialLayout} components={{ notes: Note }} />
    </NotesContext.Provider>
  );
}
```

Provider updates reach panes and companions. `getPaneState` remains a mount-time
stable reference for application stores; it is not a reactive state selector.
