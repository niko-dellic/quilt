import { TabRegistry } from 'quilt-vanilla';
import type { WorkspaceHandle } from 'quilt-vanilla';
import type { Layout, Node as LayoutNode, Pane } from 'quilt-core';
export const initial: Layout = {
  version: 1,
  maximized: null,
  popouts: [],
  panes: {
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
                    panes: ['hotkeys', 'tools'],
                    active: 'hotkeys',
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
export function bindWorkspace(value: WorkspaceHandle) {
  workspace = value;
}
// Presets share pane IDs and application data; each keeps its session layout edits.
function workspaceLayout(content: LayoutNode): Layout {
  const layout = structuredClone(initial);
  if (layout.root.kind === 'split' && layout.root.children[1].kind === 'split') {
    layout.root.children[1].children[0] = content;
  }
  return layout;
}
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
          panes: ['theming', 'notes', 'tools', 'hotkeys', 'activity', 'timeline'],
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
              panes: ['canvas', 'tools', 'hotkeys'],
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
    workspaceLayouts.set(activeWorkspace, workspace.exportLayout());
    workspace.loadLayout(workspaceLayouts.get(id) ?? preset.layout);
    activeWorkspace = id;
    workspaceListeners.forEach((listener) => listener());
  },
  reset() {
    workspace.loadLayout(workspaces.find((workspace) => workspace.id === activeWorkspace)!.layout);
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
export interface Camera {
  azimuth: number;
  elevation: number;
  zoom: number;
}
export const defaultCamera: Readonly<Camera> = { azimuth: Math.PI / 4, elevation: 0.5, zoom: 1 };
// App-owned view state survives pane remounts and companion-window transfers.
const cameras = new Map<string, Camera>();
export function cameraFor(paneId: string): Camera {
  let camera = cameras.get(paneId);
  if (!camera) {
    camera = { ...defaultCamera };
    cameras.set(paneId, camera);
  }
  return camera;
}
