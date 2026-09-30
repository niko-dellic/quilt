import { joinRange } from './join.js';
import { findNode, findParent, groups, paneIds, parseLayout, validate } from './model.js';
import { LayoutError } from './types.js';
import type {
  AutoCollapse,
  LayoutStoreOptions,
  JoinOptions,
  Axis,
  Capability,
  CapabilityPolicy,
  Change,
  CommandOptions,
  Group,
  Layout,
  Node,
  Pane,
  WindowPlacement,
} from './types.js';
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};
function problem(message: string): never {
  throw new LayoutError([{ path: 'command', message }]);
}
export class LayoutStore {
  private state: Layout;
  private initial: Layout;
  private listeners = new Set<(event: Change) => void>();
  private errors = new Set<(error: unknown) => void>();
  private disposed = false;
  private serial = 0;
  private closedTabs: { pane: Pane; groupId: string; index: number }[] = [];
  private notifying = false;
  private pending: Change[] = [];
  private autoCollapse: AutoCollapse = 'disabled';
  private capabilities: CapabilityPolicy = {};
  constructor(input: unknown, options: LayoutStoreOptions = {}) {
    this.setCapabilities(options.capabilities);
    this.setAutoCollapse(options.autoCollapse ?? 'disabled');
    this.state = freeze(parseLayout(input));
    this.initial = this.export();
  }
  /** Stable immutable snapshot, suitable for useSyncExternalStore. */
  getSnapshot = (): Layout => this.state;
  export(): Layout {
    return structuredClone(this.state);
  }
  subscribe = (listener: (event: Change) => void): (() => void) => {
    this.alive();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  onError(listener: (error: unknown) => void): () => void {
    this.errors.add(listener);
    return () => {
      this.errors.delete(listener);
    };
  }
  private alive() {
    if (this.disposed) problem('Store has been disposed');
  }
  private report(error: unknown) {
    for (const listener of this.errors) {
      try {
        listener(error);
      } catch {
        /* A reporting callback cannot invalidate a committed layout. */
      }
    }
  }
  private commit(action: string, mutate: (draft: Layout) => void) {
    this.alive();
    let next: Layout;
    try {
      next = this.export();
      mutate(next);
      next = parseLayout(next);
    } catch (error) {
      this.report(error);
      throw error;
    }
    // Update session history only after validation, before notifying subscribers.
    if (action === 'load') this.closedTabs = [];
    if (action === 'close' || action === 'closeGroup') {
      for (const pane of Object.values(this.state.panes)) {
        if (Object.hasOwn(next.panes, pane.id)) continue;
        const group = groups(this.state.root).find((g) => g.panes.includes(pane.id));
        const detached = this.state.popouts.find((p) => p.paneId === pane.id);
        this.closedTabs.push({
          pane: structuredClone(pane),
          groupId: group?.id ?? detached!.groupId,
          index: group ? group.panes.indexOf(pane.id) : detached!.index,
        });
      }
      this.closedTabs = this.closedTabs.slice(-50);
    }
    if (action === 'restoreClosedTab') {
      this.closedTabs = this.closedTabs.filter(
        (entry) => !Object.hasOwn(next.panes, entry.pane.id),
      );
    }
    this.state = freeze(next);
    this.pending.push({ action, layout: this.state });
    if (this.notifying) return;
    this.notifying = true;
    try {
      while (this.pending.length) {
        const event = this.pending.shift()!;
        for (const listener of [...this.listeners]) {
          if (!this.listeners.has(listener)) continue;
          try {
            listener(event);
          } catch (error) {
            this.report(error);
          }
        }
      }
    } finally {
      this.notifying = false;
    }
  }

  private group(draft: Layout, id: string): Group {
    const n = findNode(draft.root, id);
    if (n?.kind !== 'group') problem('Group not found: ' + id);
    return n;
  }
  private pane(draft: Layout, id: string): Pane {
    if (!Object.hasOwn(draft.panes, id)) problem('Pane not found: ' + id);
    return draft.panes[id]!;
  }
  private permit(draft: Layout, ids: string[], cap: Capability, options: CommandOptions) {
    for (const id of ids)
      if (options.source === 'user' && !this.canPane(draft, id, cap))
        problem(`${cap} is disabled for ${id}`);
  }
  private id(draft: Layout): string {
    let id: string;
    do {
      id = `layout-${++this.serial}`;
    } while (findNode(draft.root, id));
    return id;
  }
  private replace(draft: Layout, old: Node, next: Node) {
    const parent = findParent(draft.root, old.id);
    if (parent) parent.children[parent.children[0].id === old.id ? 0 : 1] = next;
    else draft.root = next;
  }
  private detach(draft: Layout, id: string): Group {
    const g = groups(draft.root).find((n) => n.panes.includes(id));
    if (!g) problem('Pane is not docked: ' + id);
    const at = g.panes.indexOf(id);
    g.panes.splice(at, 1);
    if (g.active === id) g.active = g.panes[Math.min(at, g.panes.length - 1)] ?? null;
    return g;
  }
  getAutoCollapse(): AutoCollapse {
    return this.autoCollapse;
  }
  setAutoCollapse(mode: AutoCollapse): void {
    this.alive();
    if (!['enabled', 'protected', 'disabled'].includes(mode)) problem('Invalid autoCollapse mode');
    this.autoCollapse = mode;
  }
  private tidy(draft: Layout, source?: Group, popout = false) {
    if (
      source &&
      !source.panes.length &&
      this.autoCollapse !== 'disabled' &&
      (!popout || this.autoCollapse === 'enabled')
    ) {
      const parent = findParent(draft.root, source.id);
      if (parent)
        this.replace(draft, parent, parent.children[parent.children[0].id === source.id ? 1 : 0]);
    }
    if (draft.maximized && !findNode(draft.root, draft.maximized)) draft.maximized = null;
  }
  /** Replace session policy; layout export/load never serializes or resets it. */
  setCapabilities(policy: CapabilityPolicy = {}): void {
    this.alive();
    const flags = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        problem('Invalid capabilities');
      for (const [key, flag] of Object.entries(value!))
        if (
          ![
            'resize',
            'move',
            'reorder',
            'addTab',
            'maximize',
            'split',
            'join',
            'close',
            'popout',
          ].includes(key) ||
          typeof flag !== 'boolean'
        )
          problem('Invalid capability: ' + key);
    };
    if (!policy || typeof policy !== 'object' || Array.isArray(policy))
      problem('Invalid capability policy');
    for (const [key, value] of Object.entries(policy)) {
      if (value === undefined) continue;
      if (key === 'defaults') flags(value);
      else if (key === 'groups' || key === 'panes') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
          problem('Invalid capability overrides');
        Object.values(value).forEach(flags);
      } else problem('Unknown capability scope: ' + key);
    }
    this.capabilities = structuredClone(policy);
  }
  private canPane(layout: Layout, paneId: string, capability: Capability): boolean {
    const pane = layout.panes[paneId];
    if (!pane) return false;
    const groupId =
      groups(layout.root).find((g) => g.panes.includes(paneId))?.id ??
      layout.popouts.find((p) => p.paneId === paneId)?.groupId;
    return (
      this.capabilities.panes?.[paneId]?.[capability] ??
      pane.capabilities?.[capability] ??
      (groupId ? this.capabilities.groups?.[groupId]?.[capability] : undefined) ??
      this.capabilities.defaults?.[capability] ??
      (capability === 'addTab' || capability === 'reorder'
        ? this.canPane(layout, paneId, 'move')
        : true)
    );
  }
  can(paneId: string, capability: Capability): boolean {
    return this.canPane(this.state, paneId, capability);
  }
  private canNodeIn(layout: Layout, node: Node, capability: Capability): boolean {
    if (node.kind === 'split')
      return node.children.every((child) => this.canNodeIn(layout, child, capability));
    return node.panes.length
      ? node.panes.every((id) => this.canPane(layout, id, capability))
      : (this.capabilities.groups?.[node.id]?.[capability] ??
          this.capabilities.defaults?.[capability] ??
          (capability === 'addTab' || capability === 'reorder'
            ? this.canNodeIn(layout, node, 'move')
            : true));
  }
  /** Test every affected tab, including policy on empty regions. */
  canNode(nodeId: string, capability: Capability): boolean {
    const node = findNode(this.state.root, nodeId);
    return !!node && this.canNodeIn(this.state, node, capability);
  }
  private permitNode(layout: Layout, node: Node, capability: Capability, options: CommandOptions) {
    if (options.source === 'user' && !this.canNodeIn(layout, node, capability))
      problem(`${capability} is disabled for ${node.id}`);
  }
  load(input: unknown) {
    this.commit('load', (draft) => {
      const next = parseLayout(input);
      for (const key of Object.keys(draft)) Reflect.deleteProperty(draft, key);
      Object.assign(draft, next);
    });
  }
  reset() {
    this.load(this.initial);
  }
  setTabDisplay(groupId: string, display: Group['tabDisplay']) {
    this.commit('setTabDisplay', (draft) => {
      const group = findNode(draft.root, groupId);
      if (!group || group.kind !== 'group') problem('Expected a group id');
      if (display === undefined) delete group.tabDisplay;
      else group.tabDisplay = display;
    });
  }
  setTabPlacement(groupId: string, placement: Group['tabPlacement']) {
    this.commit('setTabPlacement', (draft) => {
      const group = findNode(draft.root, groupId);
      if (!group || group.kind !== 'group') problem('Expected a group id');
      if (placement === undefined) delete group.tabPlacement;
      else group.tabPlacement = placement;
    });
  }
  activate(groupId: string, paneId: string) {
    this.commit('activate', (d) => {
      const g = this.group(d, groupId);
      if (!g.panes.includes(paneId)) problem('Tab does not belong to group');
      g.active = paneId;
    });
  }
  resize(splitId: string, ratio: number, options: CommandOptions = {}) {
    this.commit('resize', (d) => {
      const n = findNode(d.root, splitId);
      if (n?.kind !== 'split') problem('Split not found');
      this.permitNode(d, n, 'resize', options);
      n.ratio = ratio;
    });
  }
  /** Atomically update coupled split ratios without intermediate layouts. */
  resizeMany(ratios: Record<string, number>, options: CommandOptions = {}) {
    this.commit('resize', (d) => {
      for (const [id, ratio] of Object.entries(ratios)) {
        const node = findNode(d.root, id);
        if (node?.kind !== 'split') problem('Split not found');
        this.permitNode(d, node, 'resize', options);
        node.ratio = ratio;
      }
    });
  }
  maximize(groupId: string | null, options: CommandOptions = {}) {
    this.commit('maximize', (d) => {
      if (groupId) this.permitNode(d, this.group(d, groupId), 'maximize', options);
      d.maximized = groupId;
    });
  }
  add(pane: Pane, groupId: string, options: CommandOptions = {}) {
    this.commit('add', (d) => {
      const g = this.group(d, groupId);
      this.permitNode(d, g, 'addTab', options);
      if (Object.hasOwn(d.panes, pane.id)) problem('Pane id already exists');
      Object.defineProperty(d.panes, pane.id, {
        value: structuredClone(pane),
        enumerable: true,
        writable: true,
        configurable: true,
      });
      g.panes.push(pane.id);
      g.active = pane.id;
    });
  }
  updatePane(pane: Pane) {
    this.commit('updatePane', (d) => {
      this.pane(d, pane.id);
      d.panes[pane.id] = structuredClone(pane);
    });
  }
  split(
    groupId: string,
    axis: Axis,
    pane: Pane | null,
    options: CommandOptions & { before?: boolean; ratio?: number } = {},
  ) {
    let created = '';
    this.commit('split', (d) => {
      const g = this.group(d, groupId);
      this.permitNode(d, g, 'split', options);
      if (pane) {
        if (Object.hasOwn(d.panes, pane.id)) problem('Pane id already exists');
        Object.defineProperty(d.panes, pane.id, {
          value: structuredClone(pane),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      const group: Group = {
        kind: 'group',
        id: this.id(d),
        panes: pane ? [pane.id] : [],
        active: pane?.id ?? null,
      };
      created = group.id;
      this.replace(d, g, {
        kind: 'split',
        id: this.id(d),
        axis,
        ratio: options.ratio ?? 0.5,
        children: options.before ? [group, g] : [g, group],
      });
    });
    return created;
  }
  /** Cancel only an unfilled region; never roll back edits made elsewhere. */
  removeEmptyGroup(groupId: string, options: CommandOptions = {}) {
    const existing = findNode(this.state.root, groupId);
    if (
      existing?.kind !== 'group' ||
      existing.panes.length ||
      !findParent(this.state.root, groupId)
    )
      return;
    this.commit('removeEmptyGroup', (d) => {
      this.permitNode(d, this.group(d, groupId), 'close', options);
      if (d.maximized === groupId) d.maximized = null;
      const parent = findParent(d.root, groupId)!;
      this.replace(d, parent, parent.children[parent.children[0].id === groupId ? 1 : 0]);
    });
  }
  /** Move to a tab group or to a new split at an edge. */
  move(
    paneId: string,
    groupId: string,
    position: 'tab' | 'left' | 'right' | 'top' | 'bottom' = 'tab',
    index?: number,
    options: CommandOptions = {},
  ) {
    this.commit('move', (d) => {
      const target = this.group(d, groupId);
      const source = groups(d.root).find((g) => g.panes.includes(paneId));
      if (!source) problem('Return a popped-out pane before moving it');
      const capability = source === target && position === 'tab' ? 'reorder' : 'move';
      this.permit(d, [paneId], capability, options);
      this.permitNode(d, target, capability, options);
      if (position !== 'tab') this.permitNode(d, target, 'split', options);
      if (source === target && target.panes.length === 1) return;
      this.detach(d, paneId);
      if (position === 'tab') {
        target.panes.splice(
          Math.max(0, Math.min(index ?? target.panes.length, target.panes.length)),
          0,
          paneId,
        );
        target.active = paneId;
      } else {
        const g: Group = { kind: 'group', id: this.id(d), panes: [paneId], active: paneId };
        const before = position === 'left' || position === 'top';
        this.replace(d, target, {
          kind: 'split',
          id: this.id(d),
          axis: position === 'left' || position === 'right' ? 'horizontal' : 'vertical',
          ratio: 0.5,
          children: before ? [g, target] : [target, g],
        });
      }
      this.tidy(d, source);
    });
  }
  /** Join the sibling region at this split, retaining its content as tabs. */
  join(groupId: string, options: CommandOptions = {}) {
    this.commit('join', (d) => {
      const g = this.group(d, groupId),
        parent = findParent(d.root, groupId);
      if (!parent) return;
      this.permitNode(d, parent, 'join', options);
      g.panes = paneIds(parent);
      g.active ??= g.panes[0] ?? null;
      this.replace(d, parent, g);
      this.tidy(d);
    });
  }
  /** Close all docked tabs and remove their region in one atomic command. */
  closeGroup(groupId: string, options: CommandOptions = {}) {
    this.commit('closeGroup', (d) => {
      const group = this.group(d, groupId);
      this.permitNode(d, group, 'close', options);
      for (const id of group.panes) delete d.panes[id];
      group.panes = [];
      group.active = null;
      if (d.maximized === groupId) d.maximized = null;
      const parent = findParent(d.root, groupId);
      if (parent)
        this.replace(d, parent, parent.children[parent.children[0].id === groupId ? 1 : 0]);
    });
  }
  /** Join a contiguous row/column range into the receiver, including both endpoints. */
  joinRegions(receiverId: string, otherId: string, options: JoinOptions = {}) {
    this.commit('join', (d) => {
      const receiver = this.group(d, receiverId);
      const range = joinRange(d.root, receiverId, otherId);
      if (!range) problem('Join requires contiguous regions in one row or column');
      const { row, regions, boundaries, start, end, selected } = range;
      const panes = selected.flatMap((g) => g.panes);
      selected.forEach((group) => this.permitNode(d, group, 'join', options));
      let sizes = range.weights;
      let gaps = boundaries.map(() => 0);
      if (options.extents) {
        const extent = (node: Node): number => {
          const value = options.extents![node.id];
          if (value === undefined || !Number.isFinite(value) || value <= 0)
            problem('Join extents must include a positive finite size for every node in the row');
          return value;
        };
        sizes = regions.map(extent);
        gaps = boundaries.map((split) => {
          const gap = extent(split) - extent(split.children[0]) - extent(split.children[1]);
          if (gap < -0.5) problem('Join extents must describe a non-overlapping row');
          return Math.max(0, gap);
        });
      }
      receiver.panes = panes;
      receiver.active ??= panes[0] ?? null;
      const combined =
        sizes.slice(start, end + 1).reduce((a, b) => a + b, 0) +
        gaps.slice(start, end).reduce((a, b) => a + b, 0);
      const remaining = [...regions.slice(0, start), receiver, ...regions.slice(end + 1)];
      const lengths = [...sizes.slice(0, start), combined, ...sizes.slice(end + 1)];
      const dividers = [...boundaries.slice(0, start), ...boundaries.slice(end)];
      const remainingGaps = [...gaps.slice(0, start), ...gaps.slice(end)];
      // Reuse the surviving boundary IDs and their settings. Removed boundaries alone disappear.
      let replacement = remaining[remaining.length - 1]!;
      let length = lengths[lengths.length - 1]!;
      for (let i = remaining.length - 2; i >= 0; i--) {
        const first = lengths[i]!;
        replacement = {
          ...dividers[i]!,
          ratio: first / (first + length),
          children: [remaining[i]!, replacement],
        };
        length += first + remainingGaps[i]!;
      }
      this.replace(d, row, replacement);
      if (selected.some((g) => g.id === d.maximized)) d.maximized = receiver.id;
      this.tidy(d);
    });
  }
  close(paneId: string, options: CommandOptions = {}) {
    this.commit('close', (d) => {
      this.permit(d, [paneId], 'close', options);
      this.pane(d, paneId);
      let source: Group | undefined;
      if (d.popouts.some((p) => p.paneId === paneId))
        d.popouts = d.popouts.filter((p) => p.paneId !== paneId);
      else source = this.detach(d, paneId);
      delete d.panes[paneId];
      this.tidy(d, source);
    });
  }
  canRestoreClosedTab(): boolean {
    return this.closedTabs.some((entry) => !Object.hasOwn(this.state.panes, entry.pane.id));
  }
  /** Restore the latest closed tab without undoing unrelated layout changes. */
  restoreClosedTab(): void {
    this.alive();
    const entry = [...this.closedTabs]
      .reverse()
      .find((item) => !Object.hasOwn(this.state.panes, item.pane.id));
    if (!entry) return;
    this.commit('restoreClosedTab', (d) => {
      Object.defineProperty(d.panes, entry.pane.id, {
        value: structuredClone(entry.pane),
        enumerable: true,
        writable: true,
        configurable: true,
      });
      this.dockPane(d, entry.pane.id, entry.groupId, entry.index);
    });
  }
  private dockPane(d: Layout, paneId: string, groupId: string, index: number) {
    const preferred = findNode(d.root, groupId);
    d.maximized = null;
    const candidates = [
      ...(preferred?.kind === 'group' ? [preferred] : []),
      ...groups(d.root).filter(
        (g) => g.id !== groupId && g.panes.every((id) => d.panes[id]!.header !== false),
      ),
    ];
    for (const target of candidates) {
      const previousActive = target.active;
      target.panes.splice(Math.min(index, target.panes.length), 0, paneId);
      target.active = paneId;
      if (!validate(d).length) return;
      target.panes.splice(target.panes.indexOf(paneId), 1);
      target.active = previousActive;
    }
    const g: Group = { kind: 'group', id: this.id(d), panes: [paneId], active: paneId };
    d.root = {
      kind: 'split',
      id: this.id(d),
      axis: 'horizontal',
      ratio: 0.7,
      children: [d.root, g],
    };
  }
  popout(paneId: string, placement?: WindowPlacement, options: CommandOptions = {}) {
    this.commit('popout', (d) => {
      this.permit(d, [paneId], 'popout', options);
      const group = groups(d.root).find((g) => g.panes.includes(paneId));
      if (!group) problem('Pane is not docked');
      const entry = {
        paneId,
        groupId: group.id,
        index: group.panes.indexOf(paneId),
        ...(placement ? { placement } : {}),
      };
      this.detach(d, paneId);
      d.popouts.push(entry);
      this.tidy(d, group, true);
    });
  }
  returnPane(paneId: string) {
    this.commit('return', (d) => {
      const entry = d.popouts.find((p) => p.paneId === paneId);
      if (!entry) return;
      d.popouts = d.popouts.filter((p) => p.paneId !== paneId);
      this.dockPane(d, paneId, entry.groupId, entry.index);
    });
  }
  dispose() {
    this.closedTabs = [];
    this.listeners.clear();
    this.errors.clear();
    this.pending = [];
    this.disposed = true;
  }
}
