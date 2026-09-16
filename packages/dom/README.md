# quilt-vanilla

Vanilla DOM pane layouts, tabs, themes, resizing, and same-origin browser popouts. Re-exports the core API and does not install React. MIT licensed, ESM and TypeScript.

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
- [Theme builder](https://quilt-layouts.vercel.app/themes.html) — customize, export, and import theme JSON
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
import { createLayout, LayoutStore, mountLayout } from 'quilt-vanilla';
import 'quilt-vanilla/styles.css';

const store = new LayoutStore(
  createLayout({
    pane: { id: 'notes', type: 'notes', title: 'Notes' },
  }),
);
const data = { text: 'Hello' }; // survives view remounts
const mounted = mountLayout(document.getElementById('workspace')!, {
  store,
  getPaneState: () => data,
  renderers: {
    notes: ({ element, document: doc, state }) => {
      const model = state as typeof data;
      const input = doc.createElement('textarea');
      input.value = model.text;
      input.oninput = () => {
        model.text = input.value;
      };
      element.append(input);
      return {
        dispose() {
          input.oninput = null;
        },
      };
    },
  },
});
// Call when removing the workspace:
function disposeWorkspace() {
  mounted.dispose();
  store.dispose();
}
```

The host needs an explicit height. Use a unified `PaneRegistry` to register creation metadata and renderers together, or supply a `TabRegistry` through `tabs` to offer new content; Quilt generates omitted pane IDs and preserves explicit IDs. `themes`, `themeFamilies`, `LayoutTheme`, and `MountedLayout` are public exports. The layout JSON type is `LayoutSnapshot` from this entry point.

Call `mounted.popout(id)` from a user action. Companions are same-origin and owned by the main session. Use the supplied document/window inside renderers and release every view-owned resource in `dispose`. Keep app data outside view lifetimes.

See [API](https://github.com/niko-dellic/quilt/blob/main/docs/api.md), [lifecycle](https://github.com/niko-dellic/quilt/blob/main/docs/lifecycle.md), and [migration](https://github.com/niko-dellic/quilt/blob/main/docs/migration.md).

Use `mounted.exportWorkspace()` and `mounted.loadWorkspace(input)` to round-trip
layout and appearance as JSON. Popouts export docked copies without closing live
windows. `popout` returns `Promise<boolean>` and must be called from a user gesture.
See [web integration](https://github.com/niko-dellic/quilt/blob/main/docs/integration.md)
for unified registration, custom themes, close confirmation, and storage examples.

<!-- shared-docs:start -->

## Documentation

- [Configuration and API](https://github.com/niko-dellic/quilt/blob/main/docs/api.md)
- [Themes and tab bars](https://github.com/niko-dellic/quilt/blob/main/docs/theming.md)
- [Registration, React context, persistence, and close confirmation](https://github.com/niko-dellic/quilt/blob/main/docs/integration.md)
- [Pane and window lifecycle](https://github.com/niko-dellic/quilt/blob/main/docs/lifecycle.md)
- [Application examples](https://github.com/niko-dellic/quilt/blob/main/examples/README.md)
- [0.2.1 upgrade checklist](https://github.com/niko-dellic/quilt/blob/main/docs/migration.md)
- [Local packages and consumer integration](https://github.com/niko-dellic/quilt/blob/main/docs/packaging.md)
- [Changelog](https://github.com/niko-dellic/quilt/blob/main/CHANGELOG.md)

<!-- shared-docs:end -->
