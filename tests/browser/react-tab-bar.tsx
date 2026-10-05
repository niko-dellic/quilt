import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Workspace } from 'quilt-react';
import type { Layout as LayoutSnapshot } from 'quilt-core';
import type { ScrollbarOptions, TabBarOptions } from 'quilt-vanilla';
import 'quilt-vanilla/styles.css';
const initialLayout: LayoutSnapshot = {
  version: 1,
  root: { kind: 'group', id: 'main', panes: ['a'], active: 'a' },
  panes: { a: { id: 'a', type: 'notes', title: 'Notes' } },
  popouts: [],
  maximized: null,
};
let mounts = 0;
function Notes() {
  const [value, setValue] = useState('initial');
  useEffect(() => {
    mounts++;
  }, []);
  return (
    <input aria-label="Retained state" value={value} onChange={(e) => setValue(e.target.value)} />
  );
}
const components = { notes: Notes };
function App() {
  const [scrollbars, setScrollbars] = useState<ScrollbarOptions | undefined>();
  const [borderResize, setBorderResize] = useState(false);
  const [locked, setLocked] = useState(false);
  const [shortcutMode, setShortcutMode] = useState(0);
  const [tabBar, setTabBar] = useState<TabBarOptions>({});
  return (
    <>
      <button onClick={() => setScrollbars((value) => (value ? undefined : { hideDelay: 30 }))}>
        Toggle scrollbars
      </button>
      <button onClick={() => setBorderResize((value) => !value)}>Toggle resize style</button>
      <button onClick={() => setLocked((value) => !value)}>Toggle interaction lock</button>
      <button onClick={() => setShortcutMode((mode) => (mode + 1) % 3)}>Change shortcuts</button>
      <button onClick={() => setTabBar({ mode: 'tapered', shape: 'scoop' })}>Taper</button>
      <button onClick={() => setTabBar({})}>Full</button>
      <output
        aria-label="Mounts"
        onClick={(e) => {
          e.currentTarget.textContent = String(mounts);
        }}
      >
        Read mounts
      </output>
      <Workspace
        initialLayout={initialLayout}
        components={components}
        {...(borderResize ? { resizeMode: 'border' as const } : {})}
        {...(locked ? { capabilities: { defaults: { close: false, move: false } } } : {})}
        {...(scrollbars ? { scrollbars } : {})}
        tabBar={tabBar}
        {...(shortcutMode === 0
          ? { shortcuts: true }
          : shortcutMode === 1
            ? {
                shortcuts: { maximize: { key: 'm' } },
                formatShortcut: () => 'Custom M',
              }
            : {})}
        style={{ width: 800, height: 400 }}
      />
    </>
  );
}
createRoot(document.querySelector('#host')!).render(<App />);
