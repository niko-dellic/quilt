import { groups, findNode } from 'quilt-core';
import type {
  LayoutStore,
  Pane,
  Group,
  WindowPlacement,
  AutoCollapse,
  Axis,
  CommandOptions,
  JoinOptions,
  Capability,
  Layout,
} from 'quilt-core';
import { mountLayout } from './renderer.js';
import { PaneRegistry, createPaneId } from './registry.js';
import type { PaneRegistration } from './registry.js';
import { dockLayout } from './workspace.js';
import type { LayoutTheme } from './theme.js';
import type {
  LayoutOptions,
  LayoutOptionUpdates,
  MountedLayout,
  PaneRenderer,
  TabBarOptions,
  WorkspaceSettings,
} from './types.js';

export type PaneType<T> = Omit<PaneRegistration<T>, 'type' | 'view'> & { render: T };
export type PaneTypes<T> = Record<string, PaneType<T>>;
export type WorkspaceOptions<State = unknown> = WorkspaceSettings<State> &
  import('./types.js').InitialConfiguration & {
    container: HTMLElement;
    store?: never;
  } & (unknown extends State ? {} : { getPaneState: (paneId: string) => State }) &
  (
    | {
        paneTypes: PaneTypes<PaneRenderer<State>>;
        registry?: never;
        renderers?: never;
        tabs?: never;
      }
    | {
        paneTypes?: undefined;
        registry: PaneRegistry<PaneRenderer<State>>;
        renderers?: never;
        tabs?: never;
      }
    | {
        paneTypes?: undefined;
        registry?: undefined;
        renderers?: Record<string, PaneRenderer<State>>;
        tabs?: import('./registry.js').TabRegistry;
      }
  );
export type WorkspaceOptionUpdates<State = unknown> = {
  [Key in keyof WorkspaceSettings<State>]?: WorkspaceSettings<State>[Key] | undefined;
} & (
  | {
      paneTypes?: PaneTypes<PaneRenderer<State>> | undefined;
      registry?: undefined;
      renderers?: undefined;
      tabs?: undefined;
    }
  | {
      paneTypes?: undefined;
      registry?: PaneRegistry<PaneRenderer<State>> | undefined;
      renderers?: undefined;
      tabs?: undefined;
    }
  | {
      paneTypes?: undefined;
      registry?: undefined;
      renderers?: Record<string, PaneRenderer<State>> | undefined;
      tabs?: import('./registry.js').TabRegistry | undefined;
    }
);
export interface WorkspaceChange {
  action: string;
  changes: readonly ('layout' | 'theme' | 'tabBar' | 'autoCollapse')[];
}
export interface WorkspaceEvents {
  change: WorkspaceChange;
  error: unknown;
}
export type AddPaneOptions = Partial<Omit<Pane, 'type'>> & { groupId?: string };
export interface CloseOptions {
  force?: boolean;
}
export interface PaneHandle {
  readonly id: string;
  readonly isDisposed: boolean;
  getSnapshot(): Pane;
  update(patch: Partial<Omit<Pane, 'id'>>): void;
  setTitle(title: string): void;
  activate(): void;
  move(
    groupId: string,
    position?: 'tab' | 'left' | 'right' | 'top' | 'bottom',
    index?: number,
  ): void;
  popout(placement?: WindowPlacement): Promise<boolean>;
  return(): void;
  retry(): void;
  close(options?: CloseOptions): Promise<boolean>;
}
/** The mounted API. The model and its lifetime remain private to Quilt. */
export interface WorkspaceHandle<State = unknown> {
  readonly isDisposed: boolean;
  /** Subscribe to configuration changes or errors. The returned function unsubscribes. */
  on<K extends keyof WorkspaceEvents>(
    event: K,
    listener: (event: WorkspaceEvents[K]) => void,
  ): () => void;
  /** Stable immutable arrangement snapshot, including live detached records. */
  getLayout(): Layout;
  /** Mutable arrangement copy. Use exportWorkspace for persistence with appearance. */
  exportLayout(): Layout;
  /** Validate and replace the arrangement; detached records restore docked. Invalidates old pane handles on success. */
  loadLayout(input: unknown): void;
  /** Restore the initial arrangement and appearance. */
  reset(): void;
  exportWorkspace(): import('./workspace.js').WorkspacePreset;
  /** Apply a complete preset atomically; emit one consolidated change event. */
  loadWorkspace(input: unknown): void;
  updateOptions(options: WorkspaceOptionUpdates<State>): void;
  setTheme(theme: LayoutTheme): void;
  setTabBar(tabBar: TabBarOptions): void;
  refreshTheme(): void;
  getAutoCollapse(): AutoCollapse;
  setAutoCollapse(mode: AutoCollapse): void;
  getPane(id: string): PaneHandle | undefined;
  getPanes(): PaneHandle[];
  /** Create from a registered type; undefined means its factory cancelled. */
  addPane(type: string, options?: AddPaneOptions): PaneHandle | undefined;
  insertPane(pane: Pane, groupId: string, options?: CommandOptions): void;
  updatePane(pane: Pane): void;
  activatePane(id: string): void;
  movePane(
    paneId: string,
    groupId: string,
    position?: 'tab' | 'left' | 'right' | 'top' | 'bottom',
    index?: number,
    options?: CommandOptions,
  ): void;
  splitGroup(
    groupId: string,
    axis: Axis,
    pane?: Pane | null,
    options?: CommandOptions & { before?: boolean; ratio?: number },
  ): string;
  removeEmptyGroup(groupId: string): void;
  joinGroup(groupId: string, options?: CommandOptions): void;
  joinGroups(receiverId: string, otherId: string, options?: JoinOptions): void;
  resize(splitId: string, ratio: number, options?: CommandOptions): void;
  resizeMany(ratios: Record<string, number>, options?: CommandOptions): void;
  maximize(groupId: string | null): void;
  setTabDisplay(groupId: string, display: Group['tabDisplay']): void;
  setTabPlacement(groupId: string, placement: Group['tabPlacement']): void;
  can(paneId: string, capability: Capability): boolean;
  canRestoreClosedPane(): boolean;
  restoreClosedPane(): void;
  /** Confirm and check permissions unless force is explicitly supplied. */
  closePane(id: string, options?: CloseOptions): Promise<boolean>;
  closeGroup(id: string, options?: CloseOptions): Promise<boolean>;
  /** Call during a user gesture. Resolves after destination readiness or rollback. */
  popout(id: string, placement?: WindowPlacement): Promise<boolean>;
  returnPane(id: string): void;
  retryPane(id: string): void;
  /** Idempotently cancel pending work and release views, companions, and the private model. */
  dispose(): void;
}

type InternalOptions<State> = LayoutOptionUpdates<State> & {
  paneTypes?: PaneTypes<PaneRenderer<State>> | undefined;
};

/** A mounted workspace. Call dispose once when its application container is removed. */
export class Workspace<State = unknown> implements WorkspaceHandle<State> {
  #mounted: MountedLayout<State>;
  #disposed = false;
  #handles = new Map<string, PaneHandle>();
  #listeners = {
    change: new Set<(event: WorkspaceChange) => void>(),
    error: new Set<(event: unknown) => void>(),
  };
  #cleanups: (() => void)[] = [];
  #options: InternalOptions<State>;
  #activeGroup: string | undefined;
  #batch = false;
  #initial: ReturnType<MountedLayout['exportWorkspace']>;
  constructor(options: WorkspaceOptions<State>) {
    if (!options?.container?.ownerDocument?.defaultView)
      throw new Error('Workspace requires a container in a live document');
    const { container, ...input } = options;
    const { initialLayout: _layout, initialWorkspace: _workspace, ...updates } = input;
    this.#options = { ...updates };
    const adapted = this.#adapt(this.#options);
    this.#mounted = mountLayout(container, {
      ...input,
      ...adapted,
      onError: this.#report,
    } as unknown as LayoutOptions<State>);
    this.#initial = this.#mounted.exportWorkspace();
    this.#cleanups.push(
      this.#model.subscribe((event) => {
        if (event.action === 'load') {
          this.#handles.clear();
          this.#activeGroup = undefined;
        } else
          for (const id of this.#handles.keys())
            if (!Object.hasOwn(event.layout.panes, id)) this.#handles.delete(id);
        if (!this.#batch) this.#emit({ action: event.action, changes: ['layout'] });
      }),
      this.#model.onError(this.#report),
    );
    const activate = (event: Event) => {
      const target = event.target as Element | null;
      const id = target?.closest?.('[data-node-id]')?.getAttribute('data-node-id');
      if (id && findNode(this.getLayout().root, id)?.kind === 'group') this.#activeGroup = id;
    };
    container.addEventListener('pointerdown', activate);
    container.addEventListener('focusin', activate);
    this.#cleanups.push(
      () => container.removeEventListener('pointerdown', activate),
      () => container.removeEventListener('focusin', activate),
    );
  }
  get #model(): LayoutStore {
    return this.#mounted.store as LayoutStore;
  }
  #alive() {
    if (this.#disposed) throw new Error('Workspace has been disposed');
  }
  #report = (error: unknown) => {
    try {
      this.#options.onError?.(error);
    } catch {
      /* Reporting must not interrupt cleanup. */
    }
    for (const listener of [...this.#listeners.error]) {
      if (!this.#listeners.error.has(listener)) continue;
      try {
        listener(error);
      } catch {
        /* Isolate reporters. */
      }
    }
  };
  #emit(event: WorkspaceChange) {
    for (const listener of [...this.#listeners.change]) {
      if (!this.#listeners.change.has(listener)) continue;
      try {
        listener(event);
      } catch (error) {
        this.#report(error);
      }
    }
  }
  #adapt(options: InternalOptions<State>): LayoutOptionUpdates<State> {
    const { paneTypes, ...rest } = options;
    if (paneTypes !== undefined) {
      if (rest.registry || rest.renderers || rest.tabs)
        throw new Error('paneTypes cannot be combined with registry, renderers, or tabs');
      return {
        ...rest,
        registry: new PaneRegistry(
          Object.entries(paneTypes).map(([type, { render, ...entry }]) => ({
            ...entry,
            type,
            view: render,
          })),
        ),
      };
    }
    return { ...rest, registry: rest.registry };
  }
  get isDisposed() {
    return this.#disposed;
  }
  on<K extends keyof WorkspaceEvents>(
    event: K,
    listener: (event: WorkspaceEvents[K]) => void,
  ): () => void {
    this.#alive();
    const listeners = this.#listeners[event] as Set<(event: WorkspaceEvents[K]) => void>;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
  /** Stable immutable layout snapshot. */
  getLayout = () => {
    this.#alive();
    return this.#model.getSnapshot();
  };
  exportLayout() {
    this.#alive();
    return this.#model.export();
  }
  loadLayout(input: unknown) {
    this.#alive();
    this.#model.load(dockLayout(input));
  }
  reset() {
    this.loadWorkspace(this.#initial);
  }
  exportWorkspace() {
    this.#alive();
    return this.#mounted.exportWorkspace();
  }
  loadWorkspace(input: unknown) {
    this.#alive();
    this.#batch = true;
    try {
      this.#mounted.loadWorkspace(input);
    } finally {
      this.#batch = false;
    }
    this.#emit({ action: 'loadWorkspace', changes: ['layout', 'theme', 'tabBar', 'autoCollapse'] });
  }
  updateOptions(next: WorkspaceOptionUpdates<State>) {
    this.#alive();
    if ('container' in next) throw new Error('Workspace container cannot be updated');
    const candidate = { ...this.#options, ...next };
    const adapted = this.#adapt(candidate);
    const changes: WorkspaceChange['changes'][number][] = [];
    const before = this.exportWorkspace();
    // Initial appearance is mount-only: only explicitly updated appearance keys apply.
    if (!('theme' in next)) delete adapted.theme;
    if (!('tabBar' in next)) delete adapted.tabBar;
    this.#mounted.updateOptions({ ...adapted, onError: this.#report });
    this.#options = candidate;
    const after = this.exportWorkspace();
    if (JSON.stringify(before.theme) !== JSON.stringify(after.theme)) changes.push('theme');
    if (JSON.stringify(before.tabBar) !== JSON.stringify(after.tabBar)) changes.push('tabBar');
    if (changes.length) this.#emit({ action: 'updateOptions', changes });
  }
  setTheme(theme: LayoutTheme) {
    this.updateOptions({ theme });
  }
  setTabBar(tabBar: TabBarOptions) {
    this.updateOptions({ tabBar });
  }
  refreshTheme() {
    this.#alive();
    this.#mounted.refreshTheme();
  }
  getAutoCollapse() {
    this.#alive();
    return this.#model.getAutoCollapse();
  }
  setAutoCollapse(mode: AutoCollapse) {
    this.#alive();
    const previous = this.#model.getAutoCollapse();
    this.#model.setAutoCollapse(mode);
    if (mode !== previous) this.#emit({ action: 'setAutoCollapse', changes: ['autoCollapse'] });
  }
  getPane(id: string): PaneHandle | undefined {
    this.#alive();
    if (!Object.hasOwn(this.getLayout().panes, id)) return undefined;
    let handle = this.#handles.get(id);
    if (handle) return handle;
    const workspace = this;
    const alive = () => {
      workspace.#alive();
      if (workspace.#handles.get(id) !== handle) throw new Error(`Pane ${id} has been disposed`);
    };
    handle = {
      id,
      get isDisposed() {
        return workspace.#disposed || workspace.#handles.get(id) !== handle;
      },
      getSnapshot() {
        alive();
        return workspace.getLayout().panes[id]!;
      },
      update(patch) {
        alive();
        workspace.updatePane({ ...workspace.getLayout().panes[id]!, ...patch, id });
      },
      setTitle(title) {
        this.update({ title });
      },
      activate() {
        alive();
        workspace.activatePane(id);
      },
      move(groupId, position, index) {
        alive();
        workspace.movePane(id, groupId, position, index);
      },
      async popout(placement) {
        alive();
        return workspace.popout(id, placement);
      },
      return() {
        alive();
        workspace.returnPane(id);
      },
      retry() {
        alive();
        workspace.retryPane(id);
      },
      async close(options) {
        alive();
        return workspace.closePane(id, options);
      },
    };
    Object.freeze(handle);
    this.#handles.set(id, handle);
    return handle;
  }
  getPanes(): PaneHandle[] {
    return Object.keys(this.getLayout().panes).map((id) => this.getPane(id)!);
  }
  addPane(type: string, options: AddPaneOptions = {}): PaneHandle | undefined {
    this.#alive();
    const layout = this.getLayout();
    const all = groups(layout.root);
    const groupId =
      options.groupId ?? all.find((group) => group.id === this.#activeGroup)?.id ?? all[0]!.id;
    const group = all.find((group) => group.id === groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);
    const registry = this.#adapt(this.#options).registry;
    const entry = registry?.list().find((entry) => entry.type === type);
    if (!entry) throw new Error(`Pane type is not registered: ${type}`);
    const supplied = entry.create
      ? entry.create({ groupId, source: group.active ? layout.panes[group.active] : undefined })
      : {};
    if (supplied === undefined) return undefined;
    const { groupId: _groupId, ...patch } = options;
    const pane = {
      title: entry.title,
      ...(entry.icon === undefined ? {} : { icon: entry.icon }),
      ...supplied,
      ...patch,
      type,
      id: patch.id ?? supplied.id ?? createPaneId(),
    };
    this.insertPane(pane, groupId);
    return this.getPane(pane.id);
  }
  /** Insert a fully specified serializable record (advanced model integration). */
  insertPane(pane: Pane, groupId: string, options: CommandOptions = {}) {
    this.#alive();
    this.#model.add(pane, groupId, options);
  }
  updatePane(pane: Pane) {
    this.#alive();
    this.#model.updatePane(pane);
  }
  activatePane(id: string) {
    const group = groups(this.getLayout().root).find((group) => group.panes.includes(id));
    if (!group) throw new Error(`Pane is not docked: ${id}`);
    this.#activeGroup = group.id;
    this.#model.activate(group.id, id);
  }
  movePane(
    paneId: string,
    groupId: string,
    position: 'tab' | 'left' | 'right' | 'top' | 'bottom' = 'tab',
    index?: number,
    options: CommandOptions = {},
  ) {
    this.#alive();
    this.#model.move(paneId, groupId, position, index, options);
  }
  splitGroup(
    groupId: string,
    axis: Axis,
    pane: Pane | null = null,
    options: CommandOptions & { before?: boolean; ratio?: number } = {},
  ) {
    this.#alive();
    return this.#model.split(groupId, axis, pane, options);
  }
  removeEmptyGroup(groupId: string) {
    this.#alive();
    this.#model.removeEmptyGroup(groupId);
  }
  joinGroup(groupId: string, options: CommandOptions = {}) {
    this.#alive();
    this.#model.join(groupId, options);
  }
  joinGroups(receiverId: string, otherId: string, options: JoinOptions = {}) {
    this.#alive();
    this.#model.joinRegions(receiverId, otherId, options);
  }
  resize(splitId: string, ratio: number, options: CommandOptions = {}) {
    this.#alive();
    this.#model.resize(splitId, ratio, options);
  }
  resizeMany(ratios: Record<string, number>, options: CommandOptions = {}) {
    this.#alive();
    this.#model.resizeMany(ratios, options);
  }
  maximize(groupId: string | null) {
    this.#alive();
    this.#model.maximize(groupId);
  }
  setTabDisplay(groupId: string, display: Group['tabDisplay']) {
    this.#alive();
    this.#model.setTabDisplay(groupId, display);
  }
  setTabPlacement(groupId: string, placement: Group['tabPlacement']) {
    this.#alive();
    this.#model.setTabPlacement(groupId, placement);
  }
  can(paneId: string, capability: Capability) {
    this.#alive();
    return this.#model.can(paneId, capability);
  }
  canRestoreClosedPane() {
    this.#alive();
    return this.#model.canRestoreClosedTab();
  }
  restoreClosedPane() {
    this.#alive();
    this.#model.restoreClosedTab();
  }
  async closePane(id: string, options: CloseOptions = {}): Promise<boolean> {
    this.#alive();
    if (options.force) {
      this.#model.close(id);
      return true;
    }
    return this.#mounted.requestClose(id);
  }
  async closeGroup(id: string, options: CloseOptions = {}): Promise<boolean> {
    this.#alive();
    if (options.force) {
      this.#model.closeGroup(id);
      return true;
    }
    return this.#mounted.requestClose(id, 'group');
  }
  async popout(id: string, placement?: WindowPlacement): Promise<boolean> {
    this.#alive();
    return this.#mounted.popout(id, placement);
  }
  returnPane(id: string) {
    this.#alive();
    this.#mounted.returnPane(id);
  }
  retryPane(id: string) {
    this.#alive();
    this.#mounted.retryPane(id);
  }
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#handles.clear();
    for (const cleanup of this.#cleanups.splice(0)) cleanup();
    try {
      this.#mounted.dispose();
    } finally {
      this.#listeners.change.clear();
      this.#listeners.error.clear();
    }
  }
}
