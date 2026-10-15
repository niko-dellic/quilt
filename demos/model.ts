import { adaptiveGrid } from './adaptive-layout.js';
import { mountAdaptiveController, resetAdaptiveSettings } from './adaptive.js';
import { customViewGrid } from './custom-views-layout.js';
import { layout as threeLayout } from './three-layout.js';
import { TabRegistry } from 'quilt-vanilla';
import type { WorkspaceHandle } from 'quilt-vanilla';
import type { Layout, Node as LayoutNode, Pane } from 'quilt-core';
export const initial: Layout = {
  version: 1,
  maximized: null,
  popouts: [],
  panes: {
    settings: {
      id: 'settings',
      type: 'settings',
      title: 'Settings',
      icon: 'settings',
      size: { minWidth: 230, minHeight: 200 },
    },
    theming: {
      id: 'theming',
      type: 'theming',
      title: 'Theming',
      icon: 'theming',
      size: { minWidth: 260, minHeight: 300 },
      capabilities: { popout: false },
    },
    toolbar: {
      id: 'toolbar',
      type: 'toolbar',
      title: 'Workspace toolbar',
      header: false,
      size: { minHeight: 48, maxHeight: 48 },
      capabilities: {
        resize: false,
        move: false,
        split: false,
        join: false,
        close: false,
        popout: false,
      },
    },
    tools: {
      id: 'tools',
      type: 'tools',
      icon: 'tools',
      title: 'Objects',
      size: { minWidth: 190, minHeight: 120 },
    },
    canvas: {
      id: 'canvas',
      type: 'canvas',
      icon: 'canvas',
      title: 'Scene',
      size: { minWidth: 280, minHeight: 180 },
    },
    notes: {
      id: 'notes',
      type: 'notes',
      icon: 'notes',
      title: 'Inspector',
      size: { minWidth: 220, minHeight: 180 },
    },
    activity: {
      id: 'activity',
      type: 'activity',
      icon: 'activity',
      title: 'Activity',
      size: { minWidth: 220, minHeight: 180 },
    },
    hotkeys: {
      id: 'hotkeys',
      type: 'hotkeys',
      icon: 'hotkeys',
      title: 'Hotkeys',
      size: { minHeight: 200 },
    },
    timeline: {
      id: 'timeline',
      type: 'timeline',
      icon: 'timeline',
      title: 'Timeline',
      size: { minHeight: 110 },
    },
    footer: {
      id: 'footer',
      type: 'footer',
      title: 'Status bar',
      header: false,
      size: { minHeight: 28, maxHeight: 28 },
      capabilities: {
        resize: false,
        move: false,
        split: false,
        join: false,
        close: false,
        popout: false,
      },
    },
  },
  root: {
    kind: 'split',
    id: 'top',
    axis: 'vertical',
    ratio: 0.08,
    children: [
      { kind: 'group', id: 'toolbar-group', panes: ['toolbar'], active: 'toolbar' },
      {
        kind: 'split',
        id: 'footer-split',
        axis: 'vertical',
        ratio: 0.95,
        children: [
          {
            kind: 'split',
            id: 'timeline-split',
            axis: 'vertical',
            ratio: 0.78,
            children: [
              {
                kind: 'split',
                id: 'tools-split',
                axis: 'horizontal',
                ratio: 0.19,
                children: [
                  {
                    kind: 'group',
                    id: 'tools-group',
                    panes: ['settings', 'hotkeys', 'tools'],
                    active: 'settings',
                  },
                  {
                    kind: 'split',
                    id: 'inspector-split',
                    axis: 'horizontal',
                    ratio: 0.65,
                    children: [
                      {
                        kind: 'group',
                        id: 'scene-group',
                        dedicatedPaneId: 'canvas',
                        tabPlacement: 'left',
                        tabDisplay: 'compact',
                        panes: ['canvas'],
                        active: 'canvas',
                      },
                      {
                        kind: 'group',
                        id: 'inspector-group',
                        panes: ['theming', 'notes', 'activity'],
                        active: 'theming',
                      },
                    ],
                  },
                ],
              },
              {
                kind: 'group',
                id: 'timeline-group',
                panes: ['timeline'],
                active: 'timeline',
              },
            ],
          },
          { kind: 'group', id: 'footer-group', panes: ['footer'], active: 'footer' },
        ],
      },
    ],
  },
};
export let workspace: WorkspaceHandle;
const workspaceBindings = new Set<(value: WorkspaceHandle) => void>();
export function onWorkspace(listener: (value: WorkspaceHandle) => void) {
  workspaceBindings.add(listener);
  if (workspace) listener(workspace);
  return () => {
    workspaceBindings.delete(listener);
  };
}
let adaptiveController: ReturnType<typeof mountAdaptiveController> | undefined;
export function bindWorkspace(value: WorkspaceHandle) {
  adaptiveController?.dispose();
  workspace = value;
  adaptiveController = mountAdaptiveController(
    value,
    document.querySelector<HTMLElement>('#workspace')!,
    () => activeWorkspace === 'adaptive',
  );
  for (const listener of workspaceBindings) listener(value);
}
// Presets share pane IDs and application data; each keeps its session layout edits.
function workspaceLayout(content: LayoutNode): Layout {
  const layout = structuredClone(initial);
  if (layout.root.kind === 'split' && layout.root.children[1].kind === 'split') {
    layout.root.children[1].children[0] = content;
  }
  return layout;
}
const threeWorkspace = workspaceLayout({
  kind: 'split',
  id: 'four-view-sidebar',
  axis: 'horizontal',
  ratio: 0.76,
  children: [
    threeLayout.root,
    {
      kind: 'group',
      id: 'inspector-group',
      panes: ['theming', 'notes', 'activity'],
      active: 'theming',
    },
  ],
});
threeWorkspace.panes = {
  toolbar: initial.panes.toolbar!,
  footer: initial.panes.footer!,
  theming: initial.panes.theming!,
  notes: initial.panes.notes!,
  activity: initial.panes.activity!,
  ...threeLayout.panes,
};
function customWorkspace(rows: number, columns: number): Layout {
  const grid = customViewGrid(rows, columns);
  const layout = structuredClone(threeWorkspace);
  const content: LayoutNode = {
    kind: 'split',
    id: 'custom-controls-split',
    axis: 'vertical',
    ratio: 0.1,
    children: [
      {
        kind: 'group',
        id: 'custom-controls-group',
        panes: ['view-controls'],
        active: 'view-controls',
      },
      grid.root,
    ],
  };
  if (layout.root.kind === 'split' && layout.root.children[1].kind === 'split')
    layout.root.children[1].children[0] = content;
  for (const id of [...Object.keys(threeLayout.panes), 'theming', 'notes', 'activity'])
    delete layout.panes[id];
  Object.assign(layout.panes, grid.panes);
  layout.panes['view-controls'] = {
    id: 'view-controls',
    type: 'view-controls',
    title: 'Viewport grid',
    header: false,
    size: { minHeight: 64, maxHeight: 64 },
    capabilities: {
      close: false,
      popout: false,
      move: false,
      split: false,
      join: false,
      resize: false,
    },
  };
  return layout;
}
function adaptiveWorkspace(rows = 6, columns = 10): Layout {
  const grid = adaptiveGrid(rows, columns);
  const layout = workspaceLayout({
    kind: 'split',
    id: 'adaptive-controls-split',
    axis: 'vertical',
    ratio: 0.08,
    children: [
      {
        kind: 'group',
        id: 'adaptive-controls-group',
        panes: ['adaptive-controls'],
        active: 'adaptive-controls',
      },
      grid.root,
    ],
  });
  layout.panes = {
    toolbar: initial.panes.toolbar!,
    footer: initial.panes.footer!,
    ...grid.panes,
    'adaptive-controls': {
      id: 'adaptive-controls',
      type: 'adaptive-controls',
      title: 'Adaptive grid',
      header: false,
      size: { minHeight: 64, maxHeight: 64 },
      capabilities: {
        close: false,
        popout: false,
        move: false,
        split: false,
        join: false,
        resize: false,
      },
    },
  };
  return layout;
}
let adaptiveSize = { rows: 6, columns: 10 };
const adaptiveGridListeners = new Set<() => void>();
export const adaptiveViews = {
  get: () => adaptiveSize,
  subscribe(listener: () => void) {
    adaptiveGridListeners.add(listener);
    return () => {
      adaptiveGridListeners.delete(listener);
    };
  },
  set(rows: number, columns: number) {
    const next = adaptiveWorkspace(rows, columns);
    if (activeWorkspace === 'adaptive') {
      adaptiveController?.leave();
      adaptiveController?.clearManualEdges();
      workspace.loadLayout(next);
      adaptiveController?.enter();
    }
    workspaceLayouts.set('adaptive', next);
    adaptiveSize = { rows, columns };
    adaptiveGridListeners.forEach((listener) => listener());
  },
};
let customGrid = { rows: 2, columns: 2 };
const gridListeners = new Set<() => void>();
export const customViews = {
  get: () => customGrid,
  subscribe(listener: () => void) {
    gridListeners.add(listener);
    return () => {
      gridListeners.delete(listener);
    };
  },
  set(rows: number, columns: number) {
    if (![rows, columns].every((value) => Number.isInteger(value) && value >= 1))
      throw new Error('Rows and columns must each be positive whole numbers.');
    if (rows === customGrid.rows && columns === customGrid.columns) return;
    const next = customWorkspace(rows, columns);
    if (activeWorkspace === 'custom') workspace.loadLayout(next);
    workspaceLayouts.set('custom', next);
    customGrid = { rows, columns };
    gridListeners.forEach((listener) => listener());
  },
};
export const workspaces = [
  { id: 'default', title: 'Default', description: 'The original workspace', layout: initial },
  {
    id: 'focus',
    title: 'Focus',
    description: 'A large scene with supporting tools in one sidebar',
    layout: workspaceLayout({
      kind: 'split',
      id: 'focus-split',
      axis: 'horizontal',
      ratio: 0.76,
      children: [
        {
          kind: 'group',
          id: 'scene-group',
          tabPlacement: 'left',
          tabDisplay: 'compact',
          panes: ['canvas'],
          active: 'canvas',
        },
        {
          kind: 'group',
          id: 'inspector-group',
          panes: ['settings', 'theming', 'notes', 'tools', 'hotkeys', 'activity', 'timeline'],
          active: 'theming',
        },
      ],
    }),
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Scene and timeline beside the inspector and settings',
    layout: workspaceLayout({
      kind: 'split',
      id: 'review-split',
      axis: 'horizontal',
      ratio: 0.7,
      children: [
        {
          kind: 'split',
          id: 'timeline-split',
          axis: 'vertical',
          ratio: 0.7,
          children: [
            {
              kind: 'group',
              id: 'scene-group',
              tabPlacement: 'left',
              tabDisplay: 'compact',
              panes: ['canvas', 'settings', 'tools', 'hotkeys'],
              active: 'canvas',
            },
            {
              kind: 'group',
              id: 'timeline-group',
              panes: ['timeline', 'activity'],
              active: 'timeline',
            },
          ],
        },
        {
          kind: 'split',
          id: 'review-inspector-split',
          axis: 'vertical',
          ratio: 0.5,
          children: [
            { kind: 'group', id: 'inspector-group', panes: ['notes'], active: 'notes' },
            { kind: 'group', id: 'theming-group', panes: ['theming'], active: 'theming' },
          ],
        },
      ],
    }),
  },
  {
    id: 'three',
    title: '4 view',
    description: 'Four cameras sharing one 3D scene',
    layout: threeWorkspace,
  },
  {
    id: 'custom',
    title: 'Custom views',
    description: 'Choose rows and columns of shared scene views',
    layout: customWorkspace(2, 2),
  },
  {
    id: 'adaptive',
    title: 'Adaptive',
    description: 'A living grid that responds to focus',
    layout: adaptiveWorkspace(),
  },
] as const;
export type WorkspaceId = (typeof workspaces)[number]['id'];
let activeWorkspace: WorkspaceId = 'default';
const workspaceLayouts = new Map<WorkspaceId, Layout>();
const workspaceListeners = new Set<() => void>();
export const workspaceSession = {
  get: () => activeWorkspace,
  subscribe(listener: () => void) {
    workspaceListeners.add(listener);
    return () => {
      workspaceListeners.delete(listener);
    };
  },
  select(id: WorkspaceId) {
    if (id === activeWorkspace) return;
    const preset = workspaces.find((workspace) => workspace.id === id)!;
    if (activeWorkspace === 'adaptive') adaptiveController?.leave();
    workspaceLayouts.set(activeWorkspace, workspace.exportLayout());
    activeWorkspace = id;
    workspace.loadLayout(workspaceLayouts.get(id) ?? preset.layout);
    if (id === 'adaptive') adaptiveController?.enter();
    workspaceListeners.forEach((listener) => listener());
  },
  reset() {
    if (activeWorkspace === 'adaptive') {
      adaptiveController?.leave();
      adaptiveSize = { rows: 6, columns: 10 };
      adaptiveGridListeners.forEach((listener) => listener());
      resetAdaptiveSettings();
    }
    if (activeWorkspace === 'custom') {
      customGrid = { rows: 2, columns: 2 };
      gridListeners.forEach((listener) => listener());
    }
    workspace.loadLayout(workspaces.find((workspace) => workspace.id === activeWorkspace)!.layout);
    if (activeWorkspace === 'adaptive') adaptiveController?.enter();
  },
};
export interface DemoData {
  note: string;
  color: string;
  grid: boolean;
  changes: number;
}
let data: DemoData = {
  note: 'Edit these notes. Changes are retained when the inspector moves between windows.',
  color: '#91bfa9',
  grid: true,
  changes: 0,
};
const listeners = new Set<() => void>();
export const state = {
  get: () => data,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  update: (patch: Partial<DemoData>) => {
    data = { ...data, ...patch, changes: data.changes + 1 };
    listeners.forEach((fn) => fn());
  },
};
export const getPaneState = () => state;
export const tabs = new TabRegistry([
  {
    id: 'canvas',
    title: 'Canvas',
    description: 'Interactive scene viewport',
    icon: 'canvas',
    keywords: ['scene', '3d', 'viewport'],
    create: () => ({
      id: crypto.randomUUID(),
      type: 'canvas',
      icon: 'canvas',
      title: 'Scene',
      size: { minWidth: 180, minHeight: 120 },
    }),
  },
  ...[
    ['notes', 'Notes', 'Inspector and working notes'],
    ['tools', 'Objects', 'Scene object collection'],
    ['activity', 'Activity', 'Application activity'],
    ['timeline', 'Timeline', 'Animation and playback'],
    ['hotkeys', 'Hotkeys', 'Keyboard and mouse controls'],
    ['settings', 'Settings', 'Live workspace behavior and interaction rules'],
  ].map(([type, title, description]) => ({
    id: type!,
    title: title!,
    description: description!,
    icon: type!,
    create: (): Pane => ({
      id: crypto.randomUUID(),
      type: type!,
      icon: type!,
      title: title!,
      size: { minWidth: 180, minHeight: 120 },
    }),
  })),
]);
