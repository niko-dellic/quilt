import { defaultTheme } from './theme.js';
import { surfaces, swatchBackground } from './surfaces.js';
import { renderIcon } from './icons.js';
import 'quilt-react/styles.css';
import { createRoot } from 'react-dom/client';
import { createRef, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { Workspace } from 'quilt-react';
import type { PaneProps } from 'quilt-react';
import type { WorkspaceHandle } from 'quilt-react';
import { initial, bindWorkspace, state, getPaneState, tabs } from './model.js';
import { imperativeView } from './views.js';
import { setupShell } from './shell.js';
function Notes() {
  const data = useSyncExternalStore(state.subscribe, state.get, state.get);
  return (
    <div className="demo-inspector">
      <p className="eyebrow">SELECTED OBJECT</p>
      <h2>Assembly 01</h2>
      <p className="muted">3 objects selected</p>
      <div className="eyebrow">SURFACE</div>
      <div className="swatches">
        {surfaces.map(({ name, color }) => (
          <button
            key={color}
            type="button"
            aria-label={`Use ${name.toLowerCase()} surface`}
            aria-pressed={data.color === color}
            style={{ background: swatchBackground(color) }}
            onClick={() => state.update({ color })}
          />
        ))}
      </div>
      <label className="field-label">
        Working notes
        <textarea
          aria-label="Working notes"
          value={data.note}
          onChange={(e) => state.update({ note: e.target.value })}
        />
      </label>
      <p className="footnote">Notes are retained when the pane moves.</p>
    </div>
  );
}
function Imperative(props: PaneProps) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!host.current) return;
    const element = host.current;
    const view = imperativeView({ ...props, element }) ?? { dispose() {} };
    const observer = new ResizeObserver(() =>
      view.resize?.(element.clientWidth, element.clientHeight),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      view.dispose();
    };
  }, [props.pane.id, props.document]);
  return <div ref={host} style={{ width: '100%', height: '100%' }} />;
}
const components = {
  notes: Notes,
  theming: Imperative,
  canvas: Imperative,
  toolbar: Imperative,
  tools: Imperative,
  timeline: Imperative,
  hotkeys: Imperative,
  activity: Imperative,
  footer: Imperative,
};
const demoTabBar = { attachment: 'floating', fit: 'fit' } as const;
const ref = createRef<WorkspaceHandle>();
const root = createRoot(document.querySelector('#workspace')!);
root.render(
  <Workspace
    ref={ref}
    initialLayout={initial}
    onReady={(handle) => {
      bindWorkspace(handle);
      setupShell(() => handle);
    }}
    components={components}
    getPaneState={getPaneState}
    tabs={tabs}
    theme={defaultTheme}
    renderIcon={renderIcon}
    shortcuts
    tabBar={demoTabBar}
  />,
);
