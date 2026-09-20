import type { Layout } from 'quilt-core';
import { Workspace, TabRegistry, PaneRegistry } from 'quilt-vanilla';
import 'quilt-vanilla/styles.css';
import type { PaneRenderer } from 'quilt-vanilla';
import type { WorkspaceHandle } from 'quilt-vanilla';
const data = { text: 'initial' };
const stats = { mounts: 0, disposals: 0, live: 0, errors: [] as string[] };
const fixture: Layout = {
  version: 1,
  maximized: null,
  popouts: [],
  root: {
    kind: 'split',
    id: 'split',
    axis: 'horizontal',
    ratio: 0.5,
    children: [
      { kind: 'group', id: 'left', panes: ['a'], active: 'a' },
      { kind: 'group', id: 'right', panes: ['b'], active: 'b' },
    ],
  },
  panes: {
    a: { id: 'a', type: 'test', title: 'A', size: { minWidth: 100 } },
    b: { id: 'b', type: 'test', title: 'B', size: { minWidth: 100 } },
  },
};
const tabs = new TabRegistry();
let mounted: WorkspaceHandle;
let fail = false,
  blocked = false;
function mount() {
  mounted = new Workspace<unknown>({
    container: document.querySelector('#host')!,
    initialLayout: fixture,
    ...(new URLSearchParams(location.search).has('no-registry') ? {} : { tabs }),
    shortcuts: new URLSearchParams(location.search).has('shortcuts'),
    getPaneState: () => data,
    onError: (e) => stats.errors.push(String(e)),
    openWindow: () =>
      blocked ? null : window.open('about:blank', '', 'popup=yes,width=400,height=400'),
    renderers: {
      test: (context) => {
        if (fail && context.location === 'popout') throw Error('Deliberate destination failure');
        stats.mounts++;
        stats.live++;
        const input = context.document.createElement('input');
        input.setAttribute('aria-label', context.pane.title);
        input.value = data.text;
        input.oninput = () => (data.text = input.value);
        context.element.append(input);
        return {
          dispose() {
            stats.disposals++;
            stats.live--;
          },
        };
      },
    },
  });
}
mount();
document.querySelector('#open')!.addEventListener('click', () => mounted.popout('a'));
document.querySelector('#return')!.addEventListener('click', () => mounted.returnPane('a'));
let extra:
  | {
      store: WorkspaceHandle;
      mounted: WorkspaceHandle;
    }
  | undefined;
const unified = new PaneRegistry<PaneRenderer>();
export const harness = {
  Workspace,
  unified,
  get extra() {
    return extra!;
  },
  secondary() {
    const host = document.createElement('div');
    host.id = 'secondary';
    host.style.cssText = 'width:900px;height:200px';
    document.body.append(host);
    const other = new Workspace<unknown>({
      container: host,
      initialLayout: fixture,
      renderers: {},
      shortcuts: true,
    });
    extra = { store: other, mounted: other };
    return;
  },
  useRegistry() {
    const initialLayout = mounted.exportLayout();
    mounted.dispose();
    mounted = new Workspace<unknown>({
      container: document.querySelector('#host')!,
      initialLayout,
      registry: unified,
    });
  },
  registerTest() {
    return unified.register({
      type: 'test',
      title: 'Registered',
      confirmClose: true,
      view: ({ element }) => {
        element.textContent = 'Dynamic renderer';
        return { dispose() {} };
      },
    });
  },
  get mounted() {
    return mounted;
  },
  tabs,
  setTabBar: (options: import('quilt-vanilla').TabBarOptions) => mounted.setTabBar(options),
  setTheme: (theme: import('quilt-vanilla').LayoutTheme) => mounted.setTheme(theme),
  get store() {
    return mounted;
  },
  stats,
  fixture,
  block: () => {
    blocked = true;
  },
  fail: () => {
    fail = true;
  },
  dispose: () => mounted.dispose(),
  remount: () => {
    mounted.dispose();
    mount();
  },
  open: () => mounted.popout('a'),
};
declare global {
  interface Window {
    harness: typeof harness;
  }
}
window.harness = harness;
