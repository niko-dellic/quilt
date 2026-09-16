# Vanilla quickstart

```sh
npm install quilt-vanilla
```

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
