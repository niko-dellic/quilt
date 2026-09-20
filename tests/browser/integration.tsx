import {
  StrictMode,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  createRef,
} from 'react';
import { createRoot } from 'react-dom/client';
import { Workspace, createLayout } from 'quilt-react';
import type { PaneProps, WorkspaceHandle } from 'quilt-react';
import 'quilt-react/styles.css';
const context = createContext('missing');
const initialLayout = createLayout({ pane: { id: 'a', type: 'note', title: 'Note' } });
const handle = createRef<WorkspaceHandle>();
const stats = { mounts: 0, live: 0, ready: 0, early: [] as string[], errors: [] as string[] };
let ownedStore: WorkspaceHandle;
const ownedStores: WorkspaceHandle[] = [];
let fail = false;
function Note(props: PaneProps) {
  const value = useContext(context);
  useEffect(() => {
    stats.mounts++;
    stats.live++;
    return () => {
      stats.live--;
    };
  }, []);
  if (fail && props.location === 'popout') throw new Error('Destination failed');
  return (
    <>
      <output aria-label="Provider">{value}</output>
      <input aria-label="Local text" defaultValue="initial" />
    </>
  );
}
function Alternate() {
  return <p>Replacement</p>;
}
function App() {
  useLayoutEffect(() => {
    try {
      handle.current!.exportWorkspace();
    } catch (error) {
      stats.early.push(String(error));
    }
    void handle.current!.popout('a').catch((error) => stats.early.push(String(error)));
  }, []);
  const [version, setVersion] = useState(0);
  const [session, setSession] = useState(0);
  const [replacement, setReplacement] = useState(false);
  return (
    <context.Provider value={`context ${version}`}>
      <button onClick={() => setVersion((value) => value + 1)}>Rerender</button>
      <button onClick={() => setReplacement(true)}>Replace</button>
      <button onClick={() => setSession((value) => value + 1)}>Remount</button>
      <button
        onClick={() => {
          void handle.current?.popout('a');
        }}
      >
        Pop out
      </button>
      <Workspace
        ref={handle}
        key={session}
        {...(new URLSearchParams(location.search).has('preset')
          ? {
              initialWorkspace: {
                version: 1 as const,
                layout: initialLayout,
                theme: { panel: '#123456' },
                tabBar: { placement: 'left' as const },
                autoCollapse: 'protected' as const,
              },
            }
          : {
              initialLayout: {
                ...initialLayout,
                panes: {
                  ...initialLayout.panes,
                  a: { ...initialLayout.panes.a!, title: `Initial ${version}` },
                },
              },
            })}
        onReady={(workspace) => {
          stats.ready++;
          ownedStore = workspace;
          ownedStores.push(ownedStore);
        }}
        paneTypes={{ note: { title: 'Note', render: replacement ? Alternate : Note } }}
        onError={(error) => stats.errors.push(String(error))}
        style={{ height: 400 }}
      />
    </context.Provider>
  );
}
const root = createRoot(document.querySelector('#app')!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
export const integration = {
  ownedStores,
  get store() {
    return ownedStore;
  },
  stats,
  handle,
  fail: () => {
    fail = true;
  },
  dispose: () => root.unmount(),
};
declare global {
  interface Window {
    integration: typeof integration;
  }
}
window.integration = integration;
