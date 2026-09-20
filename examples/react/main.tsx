import { createContext, useContext, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createLayout, Workspace } from 'quilt-react';
import type { WorkspaceHandle, PaneProps, PaneTypes } from 'quilt-react';
import type { ComponentType } from 'react';
import 'quilt-react/styles.css';
import './style.css';
interface NoteState {
  text: string;
}
const notes = new Map<string, NoteState>();
const Label = createContext('Note');
function Note({ state }: PaneProps<NoteState>) {
  const label = useContext(Label); // This provider also reaches companion panes.
  const [text, setText] = useState(state.text);
  return (
    <div className="note">
      <label>
        {label}
        <textarea
          aria-label="Note text"
          value={text}
          onChange={(event) => {
            state.text = event.target.value;
            setText(state.text);
          }}
        />
      </label>
    </div>
  );
}
const paneTypes: PaneTypes<ComponentType<PaneProps<NoteState>>> = {
  note: { title: 'Note', render: Note, confirmClose: true },
};
const initialLayout = createLayout({ pane: { id: 'note', type: 'note', title: 'Note' } });
function App() {
  const workspace = useRef<WorkspaceHandle<NoteState>>(null);
  const [json, setJson] = useState('');
  const [status, setStatus] = useState('');
  const [label, setLabel] = useState('Application notes');
  const [active, setActive] = useState(true);
  const report = (error: unknown) =>
    setStatus(error instanceof Error ? error.message : String(error));
  return (
    <Label.Provider value={label}>
      <div className="toolbar">
        <button
          onClick={() => {
            document.documentElement.dataset.theme =
              document.documentElement.dataset.theme === 'warm' ? 'cool' : 'warm';
            workspace.current?.refreshTheme();
            setLabel(label === 'Application notes' ? 'Updated provider' : 'Application notes');
          }}
        >
          Switch theme
        </button>
        <button
          onClick={() => {
            try {
              setJson(JSON.stringify(workspace.current!.exportWorkspace(), null, 2));
              report('Saved');
            } catch (e) {
              report(e);
            }
          }}
        >
          Save workspace
        </button>
        <button
          onClick={() => {
            try {
              workspace.current!.loadWorkspace(JSON.parse(json));
              report('Loaded');
            } catch (e) {
              report(e);
            }
          }}
        >
          Load workspace
        </button>
        <button
          onClick={async () =>
            report((await workspace.current?.popout('note')) ? 'Popped out' : 'Could not pop out')
          }
        >
          Pop out note
        </button>
        <button
          onClick={() => {
            void workspace.current?.closePane('note');
          }}
        >
          Close note
        </button>
        <button onClick={() => setActive(false)}>Dispose</button>
      </div>
      <div id="workspace">
        {active && (
          <Workspace<NoteState>
            ref={workspace}
            initialLayout={initialLayout}
            paneTypes={paneTypes}
            getPaneState={(id) => {
              if (!notes.has(id)) notes.set(id, { text: 'Edit me, then pop out and return.' });
              return notes.get(id)!;
            }}
            theme={{ accent: 'var(--app-accent)', headerHeight: 'calc(2rem + 4px)' }}
            onError={report}
          />
        )}
      </div>
      <label>
        Workspace JSON
        <textarea value={json} onChange={(event) => setJson(event.target.value)} />
      </label>
      <p role="status">{status}</p>
    </Label.Provider>
  );
}
const root = createRoot(document.querySelector('#app')!);
root.render(<App />);
function dispose() {
  root.unmount();
  window.removeEventListener('pagehide', dispose);
}
window.addEventListener('pagehide', dispose);
if (import.meta.hot) import.meta.hot.dispose(dispose);
