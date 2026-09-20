# Vanilla quickstart

```sh
npm install quilt-vanilla
```

Provide `<div id="workspace" style="height:600px"></div>` in the page.

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

Use the supplied `document` and `window` in renderers so content can mount in a
companion window. Keep data outside the renderer's lifetime.
