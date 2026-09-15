# quilt-react

React components and hooks over the shared Quilt engine and DOM renderer. React 18.3 and 19 are supported peers. MIT licensed; ESM, declarations, and sources included.

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
import { createRoot } from 'react-dom/client';
import { Layout, LayoutStore, createLayout } from 'quilt-react';
import type { PaneProps } from 'quilt-react';
import 'quilt-react/styles.css';

const store = new LayoutStore(
  createLayout({
    pane: { id: 'notes', type: 'notes', title: 'Notes' },
  }),
);
const data = { text: 'Hello' };
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
const root = createRoot(document.getElementById('app')!);
root.render(
  <Layout<typeof data>
    store={store}
    components={components}
    getPaneState={getPaneState}
    style={{ width: '100%', height: 600 }}
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
