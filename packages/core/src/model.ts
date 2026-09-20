import { LayoutError } from './types.js';
import type { Bounds, Group, Issue, Json, Layout, Node, Pane } from './types.js';
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function isJson(v: unknown, seen = new Set<unknown>(), depth = 0): v is Json {
  if (depth > 256) return false;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v !== 'object' || seen.has(v)) return false;
  if (
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) !== Object.prototype &&
    Object.getPrototypeOf(v) !== null
  )
    return false;
  seen.add(v);
  const result = Object.values(v).every((x) => isJson(x, seen, depth + 1));
  seen.delete(v);
  return result;
}
export function validate(input: unknown): Issue[] {
  const errors: Issue[] = [];
  const fail = (path: string, message: string) => {
    errors.push({ path, message });
  };
  if (!record(input) || !isJson(input))
    return [{ path: '$', message: 'Expected a finite, acyclic JSON object' }];
  if (input.version !== 1) fail('version', 'Expected version 1');
  if (!record(input.panes))
    return [...errors, { path: 'panes', message: 'Expected pane dictionary' }];
  const panes = input.panes;
  for (const [id, pane] of Object.entries(panes)) {
    if (
      !record(pane) ||
      pane.id !== id ||
      !id ||
      typeof pane.type !== 'string' ||
      !pane.type ||
      typeof pane.title !== 'string'
    ) {
      fail(`panes.${id}`, 'Expected matching id, type, and title');
      continue;
    }
    if (pane.confirmClose !== undefined && typeof pane.confirmClose !== 'boolean')
      fail(`panes.${id}.confirmClose`, 'Expected boolean');
    if (pane.icon !== undefined && typeof pane.icon !== 'string')
      fail(`panes.${id}.icon`, 'Expected string');
    if (pane.header !== undefined && typeof pane.header !== 'boolean')
      fail(`panes.${id}.header`, 'Expected boolean');
    if (pane.capabilities !== undefined) {
      if (!record(pane.capabilities)) fail(`panes.${id}.capabilities`, 'Expected object');
      else
        for (const [key, value] of Object.entries(pane.capabilities))
          if (
            !['resize', 'move', 'split', 'join', 'close', 'popout'].includes(key) ||
            typeof value !== 'boolean'
          )
            fail(`panes.${id}.capabilities.${key}`, 'Unknown capability or non-boolean flag');
    }
    if (pane.size !== undefined) {
      if (!record(pane.size)) fail(`panes.${id}.size`, 'Expected object');
      else {
        for (const [key, value] of Object.entries(pane.size))
          if (
            !['minWidth', 'maxWidth', 'minHeight', 'maxHeight'].includes(key) ||
            !finite(value) ||
            value < 0
          )
            fail(`panes.${id}.size.${key}`, 'Expected nonnegative finite size');
        for (const axis of ['Width', 'Height'])
          if (
            finite(pane.size['min' + axis]) &&
            finite(pane.size['max' + axis]) &&
            Number(pane.size['min' + axis]) > Number(pane.size['max' + axis])
          )
            fail(`panes.${id}.size`, 'Minimum exceeds maximum');
      }
    }
  }
  const ids = new Set<string>();
  const assigned = new Set<string>();
  const groups = new Set<string>();
  const use = (id: unknown, path: string) => {
    if (typeof id !== 'string' || !Object.hasOwn(panes, id)) fail(path, 'Unknown pane');
    else if (assigned.has(id)) fail(path, 'Pane is placed more than once');
    else assigned.add(id);
  };
  function walk(node: unknown, path: string, depth: number) {
    if (depth > 64) {
      fail(path, 'Maximum split depth is 64');
      return;
    }
    if (!record(node) || typeof node.id !== 'string' || !node.id) {
      fail(path, 'Expected node with id');
      return;
    }
    if (ids.has(node.id)) fail(path, 'Duplicate node id');
    ids.add(node.id);
    if (node.kind === 'group') {
      groups.add(node.id);
      if (
        node.tabDisplay !== undefined &&
        node.tabDisplay !== 'automatic' &&
        node.tabDisplay !== 'compact'
      )
        fail(path + '.tabDisplay', 'Expected automatic or compact');
      if (
        node.tabPlacement !== undefined &&
        node.tabPlacement !== 'top' &&
        node.tabPlacement !== 'left'
      )
        fail(path + '.tabPlacement', 'Expected top or left');
      if (!Array.isArray(node.panes)) {
        fail(path, 'Expected pane array');
        return;
      }
      node.panes.forEach((p, i) => use(p, `${path}.panes[${i}]`));
      if (node.panes.length ? !node.panes.includes(node.active) : node.active !== null)
        fail(path + '.active', 'Active tab must belong to group (or be null for empty group)');
    } else if (node.kind === 'split') {
      if (node.gap !== undefined && (!finite(node.gap) || node.gap < 0))
        fail(path + '.gap', 'Expected nonnegative divider space');
      if (!['horizontal', 'vertical'].includes(String(node.axis)))
        fail(path + '.axis', 'Expected horizontal or vertical');
      if (!finite(node.ratio) || node.ratio <= 0 || node.ratio >= 1)
        fail(path + '.ratio', 'Expected ratio between 0 and 1');
      if (!Array.isArray(node.children) || node.children.length !== 2)
        fail(path + '.children', 'Expected two children');
      else node.children.forEach((n, i) => walk(n, `${path}.children[${i}]`, depth + 1));
    } else fail(path + '.kind', 'Expected group or split');
  }
  walk(input.root, 'root', 0);
  if (!Array.isArray(input.popouts)) fail('popouts', 'Expected array');
  else
    input.popouts.forEach((p, i) => {
      const path = `popouts[${i}]`;
      if (!record(p)) {
        fail(path, 'Expected popout object');
        return;
      }
      use(p.paneId, path + '.paneId');
      if (typeof p.groupId !== 'string' || !Number.isInteger(p.index) || Number(p.index) < 0)
        fail(path, 'Expected return group id and nonnegative index');
      if (p.placement !== undefined) {
        if (!record(p.placement)) fail(path + '.placement', 'Expected placement object');
        else
          for (const [key, value] of Object.entries(p.placement))
            if (
              !['width', 'height', 'left', 'top'].includes(key) ||
              !finite(value) ||
              (['width', 'height'].includes(key) && value <= 0)
            )
              fail(path + '.placement.' + key, 'Invalid window placement');
      }
    });
  for (const id of Object.keys(panes))
    if (!assigned.has(id)) fail(`panes.${id}`, 'Pane has no placement');
  if (
    input.maximized !== null &&
    (typeof input.maximized !== 'string' || !groups.has(input.maximized))
  )
    fail('maximized', 'Expected a group id or null');
  if (!errors.length) {
    const check = (n: Node) => {
      const b = bounds(n, input as unknown as Layout);
      if (b.minWidth > b.maxWidth || b.minHeight > b.maxHeight)
        fail(n.id, 'Pane constraints cannot coexist in this region');
      if (n.kind === 'split') n.children.forEach(check);
    };
    check(input.root as unknown as Node);
  }
  return errors;
}
export function parseLayout(input: unknown): Layout {
  const issues = validate(input);
  if (issues.length) throw new LayoutError(issues);
  return structuredClone(input) as Layout;
}
export function findNode(root: Node, id: string): Node | undefined {
  return root.id === id
    ? root
    : root.kind === 'split'
      ? (findNode(root.children[0], id) ?? findNode(root.children[1], id))
      : undefined;
}
export function findParent(root: Node, id: string): import('./types.js').Split | undefined {
  if (root.kind === 'group') return undefined;
  return root.children.some((n) => n.id === id)
    ? root
    : (findParent(root.children[0], id) ?? findParent(root.children[1], id));
}
export function groups(root: Node): Group[] {
  return root.kind === 'group' ? [root] : root.children.flatMap(groups);
}
export function paneIds(root: Node): string[] {
  return groups(root).flatMap((g) => g.panes);
}
function paneBounds(p: Pane): Bounds {
  return {
    minWidth: p.size?.minWidth ?? 0,
    maxWidth: p.size?.maxWidth ?? Infinity,
    minHeight: p.size?.minHeight ?? 0,
    maxHeight: p.size?.maxHeight ?? Infinity,
  };
}
export const DIVIDER = 4;
/** Aggregate model constraints, optionally resolving each group's bounds for a host renderer. */
export function bounds(
  node: Node,
  layout: Layout,
  resolveGroup?: (group: Group, constraints: Bounds) => Bounds,
): Bounds {
  if (node.kind === 'group') {
    const values = node.panes.map((id) => paneBounds(layout.panes[id]!));
    const constraints = {
      minWidth: Math.max(0, ...values.map((b) => b.minWidth)),
      maxWidth: Math.min(Infinity, ...values.map((b) => b.maxWidth)),
      minHeight: Math.max(0, ...values.map((b) => b.minHeight)),
      maxHeight: Math.min(Infinity, ...values.map((b) => b.maxHeight)),
    };
    return resolveGroup ? resolveGroup(node, constraints) : constraints;
  }
  const a = bounds(node.children[0], layout, resolveGroup),
    b = bounds(node.children[1], layout, resolveGroup);
  return node.axis === 'horizontal'
    ? {
        minWidth: a.minWidth + b.minWidth + (node.gap ?? DIVIDER),
        maxWidth: a.maxWidth + b.maxWidth + (node.gap ?? DIVIDER),
        minHeight: Math.max(a.minHeight, b.minHeight),
        maxHeight: Math.max(a.maxHeight, b.maxHeight),
      }
    : {
        minHeight: a.minHeight + b.minHeight + (node.gap ?? DIVIDER),
        maxHeight: a.maxHeight + b.maxHeight + (node.gap ?? DIVIDER),
        minWidth: Math.max(a.minWidth, b.minWidth),
        maxWidth: Math.max(a.maxWidth, b.maxWidth),
      };
}
/** Returns content extents; overflow retains minimums, surplus beyond maximums stays empty. */
export function allocate(
  total: number,
  ratio: number,
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
  gap = DIVIDER,
): [number, number] {
  const available = Math.max(total - gap, minA + minB);
  const used = Math.min(available, maxA + maxB);
  const low = Math.max(minA, used - maxB),
    high = Math.min(maxA, used - minB);
  const a = Math.max(low, Math.min(high, used * ratio));
  return [a, used - a];
}

/** Create independent, validated JSON for an empty or single-pane workspace. */
export function createLayout(options: { pane?: Pane; groupId?: string } = {}): Layout {
  const { pane, groupId = 'main' } = options;
  return parseLayout({
    version: 1,
    root: { kind: 'group', id: groupId, panes: pane ? [pane.id] : [], active: pane?.id ?? null },
    panes: pane ? { [pane.id]: pane } : {},
    popouts: [],
    maximized: null,
  });
}
