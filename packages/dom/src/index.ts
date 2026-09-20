export { Workspace } from './workspace-api.js';
export type {
  WorkspaceHandle,
  WorkspaceOptions,
  WorkspaceOptionUpdates,
  WorkspaceEvents,
  WorkspaceChange,
  PaneHandle,
  PaneType,
  PaneTypes,
  AddPaneOptions,
  CloseOptions,
} from './workspace-api.js';
export type {
  PaneContext,
  PaneView,
  PaneRenderer,
  TabBarStyle,
  TabBarOptions,
  InitialConfiguration,
  WorkspaceSettings,
  KeyBinding,
  CloseRequest,
} from './types.js';

export { TabRegistry } from './registry.js';
export type { TabRegistration } from './registry.js';
export { themes, themeFamilies } from './theme.js';
export type { LayoutTheme } from './theme.js';
export { LayoutError, createLayout, parseLayout, validate } from 'quilt-core';
export type {
  AutoCollapse,
  Json,
  Capability,
  Axis,
  Pane,
  Group,
  Split,
  Node,
  WindowPlacement,
  Popout,
  Layout as LayoutSnapshot,
  Issue,
  CommandOptions,
  Change,
  Bounds,
  JoinOptions,
} from 'quilt-core';
export { PaneRegistry } from './registry.js';
export type { PaneRegistration } from './registry.js';
export { parseWorkspace, dockLayout } from './workspace.js';
export type { WorkspacePreset } from './workspace.js';
export { themeProperties } from './theme.js';
export { defaultMessages } from './messages.js';
export type { Messages } from './messages.js';
