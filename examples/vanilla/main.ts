import { createLayout, Workspace } from 'quilt-vanilla';
import type { PaneTypes, PaneRenderer } from 'quilt-vanilla';
import 'quilt-vanilla/styles.css';
import './style.css';
// Data belongs to the application, and survives view disposal or document changes.
interface NoteState {
  text: string;
}
const notes = new Map<string, NoteState>();
const paneTypes: PaneTypes<PaneRenderer<NoteState>> = {
  note: {
    title: 'Note',
    confirmClose: true,
    render: ({ element, document: doc, state, signal }) => {
      const input = doc.createElement('textarea');
      input.setAttribute('aria-label', 'Note text');
      input.value = state.text;
      const change = () => {
        state.text = input.value;
      };
      input.addEventListener('input', change, { signal });
      element.classList.add('note');
      element.append(input);
    },
  },
};
const initialLayout = createLayout({ pane: { id: 'note', type: 'note', title: 'Note' } });
const workspace = new Workspace({
  container: document.querySelector<HTMLElement>('#workspace')!,
  initialLayout,
  paneTypes,
  getPaneState(id) {
    if (!notes.has(id)) notes.set(id, { text: 'Edit me, then pop out and return.' });
    return notes.get(id)!;
  },
  theme: { accent: 'var(--app-accent)', headerHeight: 'calc(2rem + 4px)' },
  onError: report,
});
const json = document.querySelector<HTMLTextAreaElement>('#json')!;
function report(error: unknown) {
  document.querySelector('#status')!.textContent =
    error instanceof Error ? error.message : String(error);
}
document.querySelector<HTMLButtonElement>('#save')!.onclick = () => {
  try {
    json.value = JSON.stringify(workspace.exportWorkspace(), null, 2);
    report('Saved');
  } catch (error) {
    report(error);
  }
};
document.querySelector<HTMLButtonElement>('#load')!.onclick = () => {
  try {
    workspace.loadWorkspace(JSON.parse(json.value));
    report('Loaded');
  } catch (error) {
    report(error);
  }
};
document.querySelector<HTMLButtonElement>('#theme')!.onclick = () => {
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === 'warm' ? 'cool' : 'warm';
  workspace.refreshTheme();
};
document.querySelector<HTMLButtonElement>('#popout')!.onclick = async () => {
  report((await workspace.popout('note')) ? 'Popped out' : 'Could not pop out');
};
document.querySelector<HTMLButtonElement>('#close')!.onclick = () => {
  void workspace.closePane('note');
};
function dispose() {
  workspace.dispose();
  window.removeEventListener('pagehide', dispose);
}
document.querySelector<HTMLButtonElement>('#dispose')!.onclick = dispose;
window.addEventListener('pagehide', dispose);
if (import.meta.hot) import.meta.hot.dispose(dispose);
