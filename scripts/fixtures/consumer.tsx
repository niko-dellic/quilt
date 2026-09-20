import { createRef, useState, useEffect, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Workspace,
  createLayout,
  useLayoutSnapshot,
  TabRegistry,
  PaneRegistry,
  themes,
} from 'quilt-react';
import type { WorkspaceHandle, PaneProps, LayoutSnapshot, WorkspaceProps } from 'quilt-react';
import 'quilt-react/styles.css';
const initialLayout = createLayout({ pane: { id: 'note', type: 'note', title: 'Note' } });
const state = { text: 'initial' };
const Context = createContext('missing');
const stats = { live: 0 };
const getPaneState = () => state;
function Note({ state: data }: PaneProps) {
  useEffect(() => {
    stats.live++;
    return () => {
      stats.live--;
    };
  }, []);
  const inherited = useContext(Context);
  if (inherited !== 'inherited') throw new Error('Provider context was lost');
  const model = data as typeof state;
  return (
    <input
      aria-label="Note data"
      defaultValue={model.text}
      onChange={(event) => {
        model.text = event.target.value;
      }}
    />
  );
}
const components = { note: Note };
const tabs = new TabRegistry();
const ref = createRef<WorkspaceHandle>();
let ownedStore: WorkspaceHandle;
function Snapshot({ store }: { store: WorkspaceHandle }) {
  const snapshot: LayoutSnapshot = useLayoutSnapshot(store);
  return <output>{snapshot.panes.note?.title}</output>;
}
function App() {
  const [store, setStore] = useState<WorkspaceHandle>();
  return (
    <>
      {store && <Snapshot store={store} />}
      <Workspace
        ref={ref}
        initialLayout={initialLayout}
        onReady={(handle) => {
          ownedStore = handle;
          setStore(handle);
        }}
        components={components}
        tabs={tabs}
        theme={themes.light}
        getPaneState={getPaneState}
        style={{ height: 400 }}
      />
      <button onClick={() => ref.current?.popout('note')}>Pop out</button>
    </>
  );
}
const props: WorkspaceProps = { initialLayout, components };
// @ts-expect-error Content creation requires TabRegistry.
props.createPane = () => undefined;
const root = createRoot(document.getElementById('app')!);
root.render(
  <Context.Provider value="inherited">
    <App />
  </Context.Provider>,
);
Object.assign(window, {
  consumer: {
    get store() {
      return ownedStore;
    },
    stats,
    state,
    dispose: () => root.unmount(),
  },
});
const unified = new PaneRegistry<import('react').ComponentType<PaneProps>>();
// @ts-expect-error Unified registration excludes component maps.
const conflict: WorkspaceProps = { initialLayout, registry: unified, components };
// @ts-expect-error Unified registration excludes tabs.
const conflictTabs: WorkspaceProps = { initialLayout, registry: unified, tabs };
void conflict;
void conflictTabs;
function TypedNote({
  state,
}: PaneProps<{
  text: string;
}>) {
  return <p>{state.text}</p>;
}
const typedLayout = (
  <Workspace
    initialLayout={initialLayout}
    components={{ note: TypedNote }}
    getPaneState={() => ({ text: 'typed' })}
  />
);
void typedLayout;
// @ts-expect-error A mounted React layout cannot accept an external store.
const externalStoreProps: WorkspaceProps = { store: {} as WorkspaceHandle };
const presetForTypes = {
  version: 1 as const,
  layout: initialLayout,
  theme: {},
  tabBar: {},
  autoCollapse: 'disabled' as const,
};
// @ts-expect-error Initial sources are mutually exclusive.
const conflictingInitialProps: WorkspaceProps = { initialLayout, initialWorkspace: presetForTypes };
void externalStoreProps;
void conflictingInitialProps;
