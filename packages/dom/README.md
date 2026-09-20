# quilt-vanilla

Vanilla DOM pane layouts, tabs, themes, resizing, and same-origin browser popouts. Includes layout JSON helpers and does not install React. MIT licensed, ESM and TypeScript.

<!-- shared-overview:start -->

Quilt is a TypeScript library for split panes, tab groups, and popout windows.
It provides a framework-independent layout model, a DOM renderer, and React bindings.
Applications supply pane content and manage their own data and storage.

- Nested horizontal and vertical splits, with minimum and maximum pane sizes.
- Tab groups with configurable orientation, appearance, and per-pane permissions.
- CSS theme tokens and typed theme presets.
- Versioned JSON for layout and workspace settings.
- Same-origin popout windows that return their panes when closed.
- Keyboard navigation, optional shortcuts, and optional close confirmation.

## Demos

- [Vanilla TypeScript](https://quilt-layouts.vercel.app/vanilla.html)
- [React](https://quilt-layouts.vercel.app/react.html)
- Customize and export theme JSON from the **Theming** tab in either demo.
- [Electron desktop downloads](https://quilt-layouts.vercel.app/electron.html) for macOS, Windows, and Ubuntu/Debian

![Quilt demo showing pane arrangements, scene interaction, and workspace presets](https://raw.githubusercontent.com/niko-dellic/quilt/main/docs/media/demo-walkthrough.webp)

See [screenshots and controls](https://github.com/niko-dellic/quilt/blob/main/docs/showcase.md) or the [application examples](https://github.com/niko-dellic/quilt/blob/main/examples/README.md).
The desktop application contains the same vanilla and React demos and runs offline.
Demo builds have no trusted developer certificate; see the [installation notes](https://github.com/niko-dellic/quilt/blob/main/docs/desktop-release.md).

<!-- shared-overview:end -->

## Install

```sh
npm install quilt-vanilla
```

Core is installed automatically; React is not required. Use an ESM-capable bundler with CSS import support, such as Vite. For local archives, see [packaging instructions](https://github.com/niko-dellic/quilt/blob/main/docs/packaging.md).

## Use

Provide a host in your HTML: `<div id="workspace" style="width:100%;height:600px"></div>`.

```ts
import { Workspace, type PaneRenderer } from 'quilt-vanilla';
import 'quilt-vanilla/styles.css';

type NotesState = { text: string };
const data: NotesState = { text: 'Notes' };
const notes: PaneRenderer<NotesState> = ({ element, document: doc, state, signal }) => {
  const input = doc.createElement('textarea');
  input.value = state.text;
  input.addEventListener(
    'input',
    () => {
      state.text = input.value;
    },
    { signal },
  );
  element.append(input);
};
const workspace = new Workspace({
  container: document.getElementById('workspace')!,
  getPaneState: () => data,
  paneTypes: { notes: { title: 'Notes', render: notes } },
});

const pane = workspace.addPane('notes', { id: 'notes' })!;
pane.setTitle('My notes');

// Call when removing the workspace.
function disposeWorkspace() {
  workspace.dispose();
}
```

The host needs an explicit height. Use `paneTypes` to supply creation metadata and renderers together; advanced `PaneRegistry` and `TabRegistry` integrations are also supported. Quilt generates omitted pane IDs and preserves explicit IDs. `themes`, `themeFamilies`, `LayoutTheme`, and `WorkspaceHandle` are public exports. The layout JSON type is `LayoutSnapshot` from this entry point.

Call `workspace.popout(id)` from a user action. Companions are same-origin and owned by the main session. Use the supplied document/window inside renderers and use `signal` and `onCleanup` to release view-owned resources. Keep app data outside view lifetimes.

See [API](https://github.com/niko-dellic/quilt/blob/main/docs/api.md), [lifecycle](https://github.com/niko-dellic/quilt/blob/main/docs/lifecycle.md), and [migration](https://github.com/niko-dellic/quilt/blob/main/docs/migration.md).

Use `workspace.exportWorkspace()` and `workspace.loadWorkspace(input)` to round-trip
layout and appearance as JSON. Popouts export docked copies without closing live
windows. `popout` returns `Promise<boolean>` and must be called from a user gesture.
See [web integration](https://github.com/niko-dellic/quilt/blob/main/docs/integration.md)
for unified registration, custom themes, close confirmation, and storage examples.

<!-- shared-docs:start -->

## Documentation

- [Getting started](https://quilt-layouts.vercel.app/docs/)
- [API reference](https://quilt-layouts.vercel.app/docs/api-reference/)
- [Themes and tab bars](https://quilt-layouts.vercel.app/docs/theming)
- [Registration, React context, persistence, and confirmation](https://quilt-layouts.vercel.app/docs/integration)
- [Examples](https://quilt-layouts.vercel.app/docs/examples)
- [Troubleshooting](https://quilt-layouts.vercel.app/docs/troubleshooting)
- [Migration](https://quilt-layouts.vercel.app/docs/migration)
- [Changelog](https://github.com/niko-dellic/quilt/blob/main/CHANGELOG.md)

<!-- shared-docs:end -->
