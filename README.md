# Quilt

[![CI](https://github.com/niko-dellic/quilt/actions/workflows/ci.yml/badge.svg)](https://github.com/niko-dellic/quilt/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/quilt-react)](https://www.npmjs.com/package/quilt-react)

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

![Quilt demo showing pane arrangements, scene interaction, and workspace presets](docs/media/demo-walkthrough.webp)

See [screenshots and controls](docs/showcase.md) or the [application examples](examples/README.md).
The desktop application contains the same vanilla and React demos and runs offline.
Demo builds have no trusted developer certificate; see the [installation notes](docs/desktop-release.md).

<!-- shared-overview:end -->

## Packages

| Package         | Purpose                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `quilt-core`    | Layout model, validation, constraints, commands, and subscriptions; no browser dependency |
| `quilt-vanilla` | DOM renderer, tabs, menus, gestures, themes, and companion windows                        |
| `quilt-react`   | React components and hooks using the same model and DOM renderer                          |

Packages include ESM, TypeScript declarations, and source maps. React is a peer
dependency of `quilt-react`; it is not required by `quilt-vanilla`.
See [host compatibility](docs/compatibility.md) for tested environments and limitations.

## Installation

```sh
# Vanilla DOM
npm install quilt-vanilla

# React
npm install quilt-react

# Layout model only
npm install quilt-core
```

The adapters install their Quilt dependencies automatically. React applications need
React and React DOM 18.3 or 19. These are peer dependencies, so Quilt shares the
application’s React installation. In an existing React app, the command above is enough.

Use ESM imports and a bundler with CSS support. Import the adapter stylesheet once
and give the workspace container an explicit height. TypeScript React applications
also need matching `@types/react` and `@types/react-dom` packages.

## Vanilla

Provide `<div id="workspace" style="height:600px"></div>` in the page.

```ts
import { LayoutStore, mountLayout, createLayout, type PaneRenderer } from 'quilt-vanilla';
import 'quilt-vanilla/styles.css';

type NotesState = { text: string };
const data: NotesState = { text: 'Notes' };
const store = new LayoutStore(
  createLayout({ pane: { id: 'notes', type: 'notes', title: 'Notes' } }),
);
const notes: PaneRenderer<NotesState> = ({ element, document: doc, state }) => {
  const input = doc.createElement('textarea');
  input.value = state.text;
  input.oninput = () => {
    state.text = input.value;
  };
  element.append(input);
  return {
    dispose() {
      input.oninput = null;
    },
  };
};
const mounted = mountLayout(document.getElementById('workspace')!, {
  store,
  getPaneState: () => data,
  renderers: { notes },
});

// Call when removing the workspace.
function disposeWorkspace() {
  mounted.dispose();
  store.dispose();
}
```

Use the supplied `document` and `window` in renderers so content can mount in a
companion window. Keep data outside the renderer's lifetime.

## React

Provide `<div id="app"></div>` in the page.

```tsx
import { createRoot } from 'react-dom/client';
import { Layout, LayoutStore, createLayout, type PaneProps } from 'quilt-react';
import 'quilt-react/styles.css';

type NotesState = { text: string };
const data: NotesState = { text: 'Notes' };
const store = new LayoutStore(
  createLayout({ pane: { id: 'notes', type: 'notes', title: 'Notes' } }),
);
function Notes({ state }: PaneProps<NotesState>) {
  return (
    <textarea
      defaultValue={state.text}
      onChange={(e) => {
        state.text = e.target.value;
      }}
    />
  );
}
const root = createRoot(document.getElementById('app')!);
root.render(
  <Layout<NotesState>
    store={store}
    components={{ notes: Notes }}
    getPaneState={() => data}
    style={{ height: 600 }}
  />,
);

function disposeWorkspace() {
  root.unmount();
  queueMicrotask(() => store.dispose());
}
```

Pane components inherit surrounding React providers through portals, including in
companion windows. Keep the store stable. Changing callback or component-map
identities does not rebuild the workspace.

Moving a pane between documents remounts its view. React-local state does not
survive that transition; use application-owned state for data that must persist.
For live updates shared between views, subscribe to that state in each component.
See [React integration](docs/integration.md#react-providers-and-updates).

## Configuration and persistence

Register pane types with `PaneRegistry`, or use separate `TabRegistry` and renderer
maps. Configure themes through CSS custom properties or `setTheme`. Tab orientation,
shape, and placement can be set globally or per region. Pane size constraints can
also define fixed toolbars and sidebars.

```ts
const json = JSON.stringify(mounted.exportWorkspace());
mounted.loadWorkspace(JSON.parse(json));
```

Workspace JSON contains layout, theme overrides, tab-bar settings, and automatic
collapse settings. Invalid input leaves the workspace unchanged. Exports save
popped-out panes in docked positions without closing their live windows. Loading
a workspace closes superseded companions and restores panes in the main layout.

Application data, renderer registrations, callbacks, stylesheets, and font files
are not included. Raw core snapshots remain available for model consumers.
See [save/load and storage examples](docs/integration.md#workspace-json).

## Limitations

- Each popout contains one pane and depends on the main session and the same origin.
- Browser popouts require a user action. Browsers may adjust their size and position
  or open a tab instead. Loading JSON does not open windows.
- Quilt does not provide storage or native window restoration.
- Electron is tested with the included hosts. Tauri native popouts and dedicated
  Vue bindings are not implemented; see [host compatibility](docs/compatibility.md).
- If a workspace is smaller than its pane constraints allow, it scrolls.

<!-- shared-docs:start -->

## Documentation

- [Configuration and API](docs/api.md)
- [Themes and tab bars](docs/theming.md)
- [Registration, React context, persistence, and close confirmation](docs/integration.md)
- [Pane and window lifecycle](docs/lifecycle.md)
- [Application examples](examples/README.md)
- [0.2.1 upgrade checklist](docs/migration.md)
- [Local packages and consumer integration](docs/packaging.md)
- [Changelog](CHANGELOG.md)

<!-- shared-docs:end -->

## Development

Use Node 24. From a checkout:

```sh
npm ci
npm run build
npm run dev
```

Open [localhost:5186](http://localhost:5186). Demos use compiled package outputs;
rebuild after changing library source.

To run the checks:

```sh
npx playwright install chromium firefox webkit
npm run check
```

The suite covers the model, browser interactions and companion windows, React
bindings, and applications installed from package archives. Electron tests need a
display; Linux CI uses Xvfb. See [contributing](CONTRIBUTING.md),
[site deployment](docs/deployment.md), and [release instructions](docs/releases.md).

## License

[MIT](LICENSE) © niko-dellic
