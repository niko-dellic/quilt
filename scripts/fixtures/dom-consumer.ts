import {
  Workspace,
  createLayout,
  TabRegistry,
  PaneRegistry,
  themes,
  validate,
} from 'quilt-vanilla';
import type {
  LayoutSnapshot,
  LayoutTheme,
  WorkspaceHandle,
  PaneRenderer,
  WorkspaceOptions,
} from 'quilt-vanilla';
import 'quilt-vanilla/styles.css';
const layout: LayoutSnapshot = createLayout();
const theme: LayoutTheme = themes.light;
const renderer: PaneRenderer = () => ({ dispose() {} });
const options: WorkspaceOptions = {
  container: document.createElement('div'),
  initialLayout: layout,
  theme,
  tabs: new TabRegistry(),
  renderers: { text: renderer },
};
// @ts-expect-error Content creation requires TabRegistry.
options.createPane = () => undefined;
const mounted: WorkspaceHandle = new Workspace({
  ...options,
});
void validate(layout);
const preset = mounted.exportWorkspace();
mounted.loadWorkspace(JSON.parse(JSON.stringify(preset)));
mounted.refreshTheme();
mounted.updateOptions({ popouts: false, messages: { Cancel: 'Dismiss' } });
mounted.dispose();
// Registration combinations must fail even for consumers using emitted declarations.
const registry = new PaneRegistry<PaneRenderer>();
// @ts-expect-error Unified registry excludes low-level renderers.
const conflicting: WorkspaceOptions = {
  container: document.createElement('div'),
  initialLayout: layout,
  registry,
  renderers: {},
};
// @ts-expect-error Unified registry excludes low-level creation tabs.
const conflictingTabs: WorkspaceOptions = {
  container: document.createElement('div'),
  initialLayout: layout,
  registry,
  tabs: new TabRegistry(),
};
void conflicting;
void conflictingTabs;
mounted.updateOptions({
  theme: undefined,
  tabBar: undefined,
  registry: undefined,
  messages: undefined,
  shortcuts: undefined,
  popouts: undefined,
  confirmClose: undefined,
});
type NotesState = {
  text: string;
};
const typedRenderer: PaneRenderer<NotesState> = ({ state }) => {
  state.text.toUpperCase();
  // @ts-expect-error Pane state retains its declared shape.
  state.missing;
  return { dispose() {} };
};
const typed: WorkspaceOptions<NotesState> = {
  container: document.createElement('div'),
  initialLayout: layout,
  renderers: { note: typedRenderer },
  getPaneState: () => ({ text: '' }),
};
void typed;
// @ts-expect-error A typed state requires an application state provider.
const missingState: WorkspaceOptions<NotesState> = {
  container: document.createElement('div'),
  initialLayout: layout,
  renderers: { note: typedRenderer },
};
void missingState;
const typedHandle = new Workspace({
  ...typed,
});
typedHandle.updateOptions({
  renderers: { note: typedRenderer },
  getPaneState: () => ({ text: 'updated' }),
});
// @ts-expect-error State providers cannot change to an incompatible type.
typedHandle.updateOptions({ getPaneState: () => 123 });
typedHandle.dispose();
// @ts-expect-error A mounted workspace owns its store.
const externalStore: WorkspaceOptions = { store: mounted };
// @ts-expect-error Initial sources are mutually exclusive.
const conflictingInitial: WorkspaceOptions = {
  container: document.createElement('div'),
  initialLayout: layout,
  initialWorkspace: preset,
};
// @ts-expect-error The internal model is not exposed.
mounted.store;
void externalStore;
void conflictingInitial;
const scoped: PaneRenderer = ({ signal, onCleanup }) => {
  document.addEventListener('click', () => {}, { signal });
  onCleanup(() => {});
};
void scoped;

const plain: WorkspaceOptions<NotesState> = {
  container: document.createElement('div'),
  paneTypes: { note: { title: 'Note', render: typedRenderer } },
  getPaneState: () => ({ text: '' }),
};
void plain;
// @ts-expect-error A plain map excludes separate renderers.
const conflictingMap: WorkspaceOptions = {
  container: document.createElement('div'),
  paneTypes: {},
  renderers: {},
};
// @ts-expect-error Option updates cannot combine registry forms.
mounted.updateOptions({ paneTypes: {}, registry });
void conflictingMap;
