import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Workspace } from 'quilt-react';
import type { CommandRegistration, WorkspaceHandle } from 'quilt-react';
import 'quilt-react/styles.css';
const initialLayout = {
  version: 1 as const,
  root: { kind: 'group' as const, id: 'main', panes: ['a'], active: 'a' },
  panes: { a: { id: 'a', type: 'notes', title: 'Notes' } },
  maximized: null,
  popouts: [],
};
const components = { notes: () => <input aria-label="Retained text" defaultValue="initial" /> };
function App() {
  const ref = useRef<WorkspaceHandle>(null);
  const [registered, setRegistered] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [count, setCount] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const commands = useMemo<readonly CommandRegistration[]>(
    () => [
      {
        id: 'app.mark',
        label: 'Mark document',
        enabled: () => enabled,
        execute: () => setCount((value) => value + 1),
      },
    ],
    [enabled],
  );
  const shortcuts = useMemo(() => ({ 'app.mark': { key: 'k' }, maximize: { key: 'k' } }), []);
  return (
    <>
      <button onClick={() => setEnabled((value) => !value)}>Toggle availability</button>
      <button onClick={() => setRegistered(false)}>Remove commands</button>
      <button
        onClick={() => {
          void ref.current!.executeAction('app.mark', { groupId: 'main' });
        }}
      >
        Execute custom command
      </button>
      <button onClick={() => ref.current!.registerShortcut('app.mark', { key: 's' })}>
        Remap custom command
      </button>
      <output aria-label="Executions">{count}</output>
      <output aria-label="Warnings">{warnings}</output>
      <Workspace
        ref={ref}
        initialLayout={initialLayout}
        components={components}
        {...(registered ? { commands, shortcuts } : {})}
        shortcutConflictPolicy="warn"
        onShortcutConflict={() => setWarnings((value) => value + 1)}
        style={{ width: 800, height: 400 }}
      />
    </>
  );
}
createRoot(document.querySelector('#host')!).render(<App />);
