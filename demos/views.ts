import { settings } from './settings.js';
import { formatShortcut } from 'quilt-vanilla';
import { mountFullscreenToggle } from './fullscreen.js';
import { mountTheming } from './shell.js';
import { canvas } from './scene.js';
export { canvas } from './scene.js';
import type { PaneRenderer, PaneContext } from 'quilt-vanilla';
import { state, workspaces, workspaceSession, onWorkspace } from './model.js';
import { surfaces, swatchBackground } from './surfaces.js';
export function field(doc: Document, tag: string, text: string, className = '') {
  const e = doc.createElement(tag);
  e.textContent = text;
  e.className = className;
  return e;
}
export const notes: PaneRenderer = ({ element, document: doc }) => {
  element.classList.add('demo-inspector');
  const caption = field(doc, 'p', 'SELECTED OBJECT', 'eyebrow'),
    title = field(doc, 'h2', 'Assembly 01');
  const description = field(doc, 'p', '3 objects selected', 'muted');
  const label = field(doc, 'label', 'Working notes', 'field-label');
  const input = doc.createElement('textarea');
  input.setAttribute('aria-label', 'Working notes');
  input.value = state.get().note;
  label.append(input);
  const colors = field(doc, 'div', '', 'swatches');
  for (const { name, color } of surfaces) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.style.background = swatchBackground(color);
    b.setAttribute('aria-label', `Use ${name.toLowerCase()} surface`);
    b.setAttribute('aria-pressed', String(state.get().color === color));
    b.dataset.surface = color;
    b.onclick = () => state.update({ color });
    colors.append(b);
  }
  element.append(
    caption,
    title,
    description,
    field(doc, 'div', 'SURFACE', 'eyebrow'),
    colors,
    label,
    field(doc, 'p', 'Notes are retained when the pane moves.', 'footnote'),
  );
  input.oninput = () => state.update({ note: input.value });
  const unsubscribe = state.subscribe(() => {
    if (input.value !== state.get().note) input.value = state.get().note;
    for (const button of colors.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.surface === state.get().color));
    }
  });
  return {
    dispose() {
      unsubscribe();
    },
  };
};
export const toolbar: PaneRenderer = ({ element, document: doc }) => {
  element.classList.add('demo-toolbar');
  const fullscreen = mountFullscreenToggle(doc);
  element.append(
    fullscreen.button,
    field(doc, 'strong', 'Untitled workspace'),
    field(doc, 'span', '/', 'slash'),
    field(doc, 'span', 'Spatial study', 'muted'),
  );
  const right = field(doc, 'div', '', 'toolbar-right');
  const switcher = field(doc, 'div', '', 'workspace-switcher');
  switcher.setAttribute('role', 'group');
  switcher.setAttribute('aria-label', 'Workspace configuration');
  for (const workspace of workspaces) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = workspace.title;
    button.title = workspace.description;
    button.dataset.workspace = workspace.id;
    button.onclick = () => workspaceSession.select(workspace.id);
    switcher.append(button);
  }
  const update = () => {
    for (const button of switcher.querySelectorAll('button')) {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.workspace === workspaceSession.get()),
      );
    }
  };
  update();
  const unsubscribe = workspaceSession.subscribe(update);
  right.append(switcher);
  right.append(field(doc, 'span', 'Local session', 'session-dot'));
  element.append(right);
  return {
    dispose() {
      unsubscribe();
      fullscreen.dispose();
      for (const button of switcher.querySelectorAll('button')) button.onclick = null;
    },
  };
};
export const tools: PaneRenderer = ({ element, document: doc }) => {
  element.classList.add('demo-tools');
  element.append(field(doc, 'p', 'COLLECTION', 'eyebrow'));
  for (const [name, meta] of [
    ['Assembly 01', '3 objects'],
    ['West volume', '100 × 200'],
    ['North volume', '155 × 80'],
    ['Courtyard', '155 × 100'],
  ]) {
    const row = field(doc, 'div', '', 'object-row');
    row.append(field(doc, 'span', name!, 'object-name'), field(doc, 'small', meta!));
    element.append(row);
  }
  element.append(
    field(
      doc,
      'p',
      'Drag a tab to an edge to split. Drop it in the center to make a tab group.',
      'tools-help',
    ),
  );
  return { dispose() {} };
};
export const timeline: PaneRenderer = ({ element, document: doc }) => {
  element.classList.add('demo-timeline');
  const row = field(doc, 'div', '', 'ruler');
  for (let i = 0; i <= 120; i += 10) row.append(field(doc, 'span', String(i).padStart(3, '0')));
  element.append(row);
  const track = field(doc, 'div', '', 'track');
  track.append(field(doc, 'span', 'Assembly 01', 'track-label'));
  const clip = field(doc, 'div', 'Spatial study', 'clip');
  track.append(clip);
  element.append(track);
  return { dispose() {} };
};
export const activity: PaneRenderer = ({ element, document: doc }) => {
  element.classList.add('demo-inspector');
  element.append(field(doc, 'p', 'SESSION', 'eyebrow'), field(doc, 'h2', 'Activity'));
  const count = field(doc, 'p', '', 'activity-count');
  const update = () => (count.textContent = `${state.get().changes} state changes`);
  update();
  element.append(
    count,
    field(
      doc,
      'p',
      'Edit the notes or change the surface color. The canvas and inspector share application-owned state, even in different windows.',
      'muted',
    ),
  );
  return { dispose: state.subscribe(update) };
};
export const hotkeys: PaneRenderer = ({ element, document: doc }) => {
  element.classList.add('demo-hotkeys');
  const frame = field(doc, 'div', '', 'hotkey-table-frame');
  const table = field(doc, 'table', '', 'hotkey-table');
  table.setAttribute('aria-label', 'Keyboard and mouse shortcuts');
  const head = doc.createElement('thead');
  const headings = doc.createElement('tr');
  for (const label of ['Shortcut', 'Action']) {
    const cell = field(doc, 'th', label);
    cell.setAttribute('scope', 'col');
    headings.append(cell);
  }
  head.append(headings);
  const body = doc.createElement('tbody');
  const appendRow = (keys: string, title: string, description: string) => {
    const row = doc.createElement('tr');
    const shortcut = doc.createElement('td');
    shortcut.append(field(doc, 'kbd', keys));
    const action = doc.createElement('td');
    action.append(
      field(doc, 'span', title, 'hotkey-action'),
      field(doc, 'span', description, 'hotkey-description'),
    );
    row.append(shortcut, action);
    body.append(row);
  };
  let unsubscribe = () => {};
  const unbind = onWorkspace((workspace) => {
    unsubscribe();
    const update = () => {
      body.replaceChildren();
      appendRow('Drag on canvas', 'Orbit scene', 'Scroll to zoom. Double-click to reset.');
      for (const registration of workspace.getShortcuts()) {
        const customLabel = workspace
          .getCommands()
          .find((command) => command.id === registration.action)?.label;
        const title =
          customLabel ??
          (registration.action === 'maximize'
            ? 'Maximize / restore'
            : registration.action
                .replace(/([A-Z])/g, (letter) => ` ${letter.toLowerCase()}`)
                .replace(/^./, (letter) => letter.toUpperCase()));
        appendRow(
          registration.bindings.map(formatShortcut).join(' or '),
          title,
          registration.action === 'restoreClosedTab'
            ? 'Reopen the most recently closed tab.'
            : 'Hovered or focused region.',
        );
      }
      for (const [keys, title, description] of [
        ['← / → or ↑ / ↓', 'Switch tabs', 'Use up/down for left-side tabs.'],
        ['Home / End', 'First / last tab', 'When a tab is focused.'],
        ['Arrow keys', 'Resize divider', 'Hold Shift for larger steps.'],
        ['Escape', 'Cancel', 'Stop a drag or close a dialog.'],
        ['Middle click', 'Close tab', 'When closing is allowed.'],
      ])
        appendRow(keys!, title!, description!);
    };
    unsubscribe = workspace.on('change', (event) => {
      if (event.changes.includes('shortcuts') || event.changes.includes('commands')) update();
    });
    update();
  });
  table.append(head, body);
  frame.append(table);
  element.append(frame);
  return {
    dispose() {
      unsubscribe();
      unbind();
    },
  };
};
export const footer: PaneRenderer = ({ element, document: doc }) => {
  element.classList.add('demo-footer');
  element.append(field(doc, 'span', '●  Ready'), field(doc, 'span', 'Local session'));
  return { dispose() {} };
};
export const theming: PaneRenderer = ({ element }) => mountTheming(element);
export const renderers = {
  settings,
  theming,
  notes,
  canvas,
  toolbar,
  tools,
  timeline,
  activity,
  hotkeys,
  footer,
};
export function imperativeView(context: PaneContext) {
  return renderers[context.pane.type as keyof typeof renderers]?.(context) ?? notes(context);
}
