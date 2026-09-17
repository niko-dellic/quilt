# React quickstart

```sh
npm install quilt-react
```

Use React and React DOM 18.3 or 19. TypeScript projects also need matching
`@types/react` and `@types/react-dom` packages.

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
See [React integration](integration.md#react-providers-and-updates).
