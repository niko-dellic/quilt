export type AutoCollapse = 'enabled' | 'protected' | 'disabled';
/** User interaction policy. More specific values override workspace defaults. */
export interface CapabilityPolicy {
  defaults?: Partial<Record<Capability, boolean>>;
  /** Region overrides, keyed by Group.id. */
  groups?: Record<string, Partial<Record<Capability, boolean>>>;
  /** Tab overrides, keyed by Pane.id; take precedence over saved pane capabilities. */
  panes?: Record<string, Partial<Record<Capability, boolean>>>;
}
export interface LayoutStoreOptions {
  capabilities?: CapabilityPolicy;
  /** Session policy; omitted defaults to disabled. Not serialized in Layout JSON. */
  autoCollapse?: AutoCollapse;
}
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Capability =
  'resize' | 'move' | 'reorder' | 'addTab' | 'maximize' | 'split' | 'join' | 'close' | 'popout';
export type Axis = 'horizontal' | 'vertical';
export interface Pane {
  /** Override the pane-type close confirmation default. */
  confirmClose?: boolean;
  id: string;
  type: string;
  title: string;
  /** Application-defined icon key, resolved by the view adapter. */
  icon?: string;
  params?: Json;
  capabilities?: Partial<Record<Capability, boolean>>;
  size?: { minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number };
  /** Hide chrome only for a one-tab group. Host commands can still operate on it. */
  header?: boolean;
}
export interface Group {
  kind: 'group';
  id: string;
  panes: string[];
  active: string | null;
  /** Persisted tab orientation for this region; omitted inherits renderer settings. */
  tabPlacement?: 'top' | 'left';
  /** Omitted inherits the workspace tab display setting. */
  tabDisplay?: 'automatic' | 'compact';
}
export interface Split {
  kind: 'split';
  id: string;
  axis: Axis;
  ratio: number;
  /** Divider space in pixels; zero removes fixed-bar gaps. Default 4. */
  gap?: number;
  children: [Node, Node];
}
export type Node = Group | Split;
export interface WindowPlacement {
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}
export interface Popout {
  paneId: string;
  groupId: string;
  index: number;
  placement?: WindowPlacement;
}
export interface Layout {
  version: 1;
  root: Node;
  panes: Record<string, Pane>;
  popouts: Popout[];
  maximized: string | null;
}
export interface Issue {
  path: string;
  message: string;
}
export class LayoutError extends Error {
  constructor(public readonly issues: Issue[]) {
    super(issues.map((i) => `${i.path}: ${i.message}`).join('; '));
    this.name = 'LayoutError';
  }
}
export interface CommandOptions {
  /** Treat capability flags as user-interaction restrictions. */ source?: 'user' | 'api';
}
export interface Change {
  action: string;
  layout: Layout;
}
export interface Bounds {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

export interface JoinOptions extends CommandOptions {
  /** Optional rendered extents along the join axis, keyed by node ID, including splits.
   * Supply the complete row to retain actual sizes under constraints and custom dividers.
   * Without measurements, joins retain proportional shares of the row/column.
   */
  extents?: Record<string, number>;
}
