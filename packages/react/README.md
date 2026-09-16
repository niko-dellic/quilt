# quilt-react

React components and hooks over the shared Quilt engine and DOM renderer. React 18.3 and 19 are supported peers. MIT licensed; ESM, declarations, and sources included.

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
npm install quilt-react
```

`quilt-core` and `quilt-vanilla` are installed automatically.

Requires React and React DOM 18.3 or 19. They are peer dependencies so Quilt shares
your application’s React instance. In an existing React application, no additional
install command is needed. When creating a new application, configure React and
React DOM as application dependencies; npm 7 and newer also resolve missing peers
automatically unless peer installation is disabled.

TypeScript apps also need matching `@types/react` and `@types/react-dom`. Use an ESM-capable bundler with CSS imports. For local archives, see [packaging instructions](https://github.com/niko-dellic/quilt/blob/main/docs/packaging.md).

## Use

Provide `<div id="app"></div>` in your HTML.

```tsx
import { createRoot } from "react-dom/client";
import { Layout, LayoutStore, createLayout } from "quilt-react";
import type { PaneProps } from "quilt-react";
import "quilt-react/styles.css";

const store = new LayoutStore(
  createLayout({
    pane: { id: "notes", type: "notes", title: "Notes" },
  }),
);
const data = { text: "Hello" };
const getPaneState = () => data;
function Notes({ state: model }: PaneProps<typeof data>) {
  return (
    <textarea
      defaultValue={model.text}
      onChange={(e) => {
        model.text = e.target.value;
      }}
    />
  );
}
const components = { notes: Notes };
const root = createRoot(document.getElementById("app")!);
root.render(
  <Layout<typeof data>
    store={store}
    components={components}
    getPaneState={getPaneState}
    style={{ width: "100%", height: 600 }}
  />,
);
// Call when removing the workspace:
function disposeWorkspace() {
  root.unmount();
  // The binding queues pane disposal beyond the parent React commit.
  queueMicrotask(() => store.dispose());
}
```

Keep the store stable. Component maps and adapter callbacks can change identity without rebuilding the workspace. Declarative panes inherit application providers through portals. `useLayoutSnapshot(store)` observes layout changes. The model type is `LayoutSnapshot`; `Layout` is the component. `MountedLayout`, `TabRegistry`, theme presets, and DOM configuration types are available here too. Attach a `MountedLayout` ref to call `popout` from a user gesture; before mounting completes, popout/requestClose resolve false; workspace configuration methods throw a clear not-mounted error.

Only standalone `reactRenderer` creates separate roots requiring explicit provider wrappers. React-local state does not survive crossing documents: retain data in an application-owned store, and subscribe inside each view when live synchronization is needed. Companion windows are same-origin and depend on the main session.

The stylesheet is identical to `quilt-vanilla/styles.css`; import either once. See [API](https://github.com/niko-dellic/quilt/blob/main/docs/api.md), [lifecycle](https://github.com/niko-dellic/quilt/blob/main/docs/lifecycle.md), and [migration](https://github.com/niko-dellic/quilt/blob/main/docs/migration.md).

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
