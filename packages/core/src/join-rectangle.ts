import type { Group, Node, RegionRect, Split } from './types.js';

/** Plan a rectangular join from measured layout geometry, without mutating the tree.
 * Only complete groups are selected. A plan exists only when the remaining tiles
 * can still be represented by binary splits without moving their boundaries.
 */
export function joinRectangle(
  root: Node,
  receiverId: string,
  otherId: string,
  rectangles: Record<string, RegionRect>,
) {
  // Browser layout quantizes each edge independently to fractional CSS pixels.
  const epsilon = 0.1;
  const right = (r: RegionRect) => r.left + r.width;
  const bottom = (r: RegionRect) => r.top + r.height;
  const near = (a: number, b: number) => Math.abs(a - b) <= epsilon;
  const same = (a: RegionRect, b: RegionRect) =>
    near(a.left, b.left) &&
    near(a.top, b.top) &&
    near(right(a), right(b)) &&
    near(bottom(a), bottom(b));
  const contains = (a: RegionRect, b: RegionRect) =>
    b.left >= a.left - epsilon &&
    b.top >= a.top - epsilon &&
    right(b) <= right(a) + epsilon &&
    bottom(b) <= bottom(a) + epsilon;
  const union = (a: RegionRect, b: RegionRect): RegionRect => {
    const left = Math.min(a.left, b.left),
      top = Math.min(a.top, b.top);
    return {
      left,
      top,
      width: Math.max(right(a), right(b)) - left,
      height: Math.max(bottom(a), bottom(b)) - top,
    };
  };
  const nodes: Node[] = [];
  const leaves: Group[] = [];
  const inspect = (node: Node): boolean => {
    nodes.push(node);
    const r = rectangles[node.id];
    if (
      !r ||
      ![r.left, r.top, r.width, r.height].every(Number.isFinite) ||
      r.width <= 0 ||
      r.height <= 0
    )
      return false;
    if (node.kind === 'group') {
      leaves.push(node);
      return true;
    }
    if (!node.children.every(inspect)) return false;
    const a = rectangles[node.children[0].id]!,
      b = rectangles[node.children[1].id]!;
    // Reject stale, overlapping, or slack measurements rather than changing the layout around them.
    return (
      same(union(a, b), r) &&
      (node.axis === 'horizontal'
        ? near(a.top, b.top) && near(bottom(a), bottom(b)) && right(a) <= b.left + epsilon
        : near(a.left, b.left) && near(right(a), right(b)) && bottom(a) <= b.top + epsilon)
    );
  };
  if (receiverId === otherId || !inspect(root)) return undefined;
  const receiver = leaves.find((g) => g.id === receiverId),
    other = leaves.find((g) => g.id === otherId);
  if (!receiver || !other) return undefined;
  const area = union(rectangles[receiverId]!, rectangles[otherId]!);
  const selected: Group[] = [];
  for (const group of leaves) {
    const r = rectangles[group.id]!;
    if (
      Math.min(right(area), right(r)) - Math.max(area.left, r.left) > epsilon &&
      Math.min(bottom(area), bottom(r)) - Math.max(area.top, r.top) > epsilon
    ) {
      if (!contains(area, r)) return undefined;
      selected.push(group);
    }
  }
  const selectedIds = new Set(selected.map((g) => g.id));
  const merged: Group = { ...receiver, panes: selected.flatMap((g) => g.panes) };
  if (merged.panes.some((id) => id !== merged.dedicatedPaneId)) delete merged.dedicatedPaneId;
  merged.active ??= merged.panes[0] ?? null;
  // Rebuild only the smallest subtree containing the selection.
  const counts = new Map<Node, number>();
  const count = (node: Node): number => {
    const cached = counts.get(node);
    if (cached !== undefined) return cached;
    const value =
      node.kind === 'group'
        ? Number(selectedIds.has(node.id))
        : count(node.children[0]) + count(node.children[1]);
    counts.set(node, value);
    return value;
  };
  let ancestor = root;
  while (ancestor.kind === 'split') {
    const child: Node | undefined = ancestor.children.find((n) => count(n) === selected.length);
    if (!child) break;
    ancestor = child;
  }
  type Tile = { node: Node; rect: RegionRect };
  const tiles: Tile[] = [];
  const collect = (node: Node) => {
    if (count(node) === 0) {
      tiles.push({ node, rect: rectangles[node.id]! });
      return;
    }
    if (node.kind === 'split') node.children.forEach(collect);
  };
  collect(ancestor);
  // Unaffected subtrees may need to be split apart to make a new full-length cut.
  const flatten = (tile: Tile): Tile[] =>
    tile.node.kind === 'group'
      ? [tile]
      : tile.node.children.flatMap((node) => flatten({ node, rect: rectangles[node.id]! }));
  const remaining = [...tiles.flatMap(flatten), { node: merged, rect: area }];
  const used = new Set(nodes.map((n) => n.id));
  let serial = 0;
  const build = (items: Tile[], region: RegionRect): Node | undefined => {
    if (items.length === 1) return same(items[0]!.rect, region) ? items[0]!.node : undefined;
    // Preserve complete unaffected subtrees and their settings.
    const untouched = tiles.find((t) => same(t.rect, region));
    if (untouched) return untouched.node;
    for (const axis of ['horizontal', 'vertical'] as const) {
      const start = (r: RegionRect) => (axis === 'horizontal' ? r.left : r.top);
      const end = (r: RegionRect) => (axis === 'horizontal' ? right(r) : bottom(r));
      const cuts = [...new Set(items.map((t) => end(t.rect)))].sort((a, b) => a - b);
      for (const cut of cuts) {
        const first = items.filter((t) => end(t.rect) <= cut + epsilon);
        const second = items.filter((t) => start(t.rect) >= cut - epsilon && !first.includes(t));
        if (!first.length || !second.length || first.length + second.length !== items.length)
          continue;
        const next = Math.min(...second.map((t) => start(t.rect)));
        const gap = Math.max(0, next - cut);
        const a =
          axis === 'horizontal'
            ? { ...region, width: cut - region.left }
            : { ...region, height: cut - region.top };
        const b =
          axis === 'horizontal'
            ? { ...region, left: next, width: right(region) - next }
            : { ...region, top: next, height: bottom(region) - next };
        const left = build(first, a),
          rightNode = build(second, b);
        if (!left || !rightNode) continue;
        const original = nodes.find(
          (n): n is Split =>
            n.kind === 'split' &&
            n.axis === axis &&
            same(rectangles[n.id]!, region) &&
            near(end(rectangles[n.children[0].id]!), cut),
        );
        const boundary =
          original ??
          nodes.find(
            (n): n is Split =>
              n.kind === 'split' &&
              n.axis === axis &&
              near(end(rectangles[n.children[0].id]!), cut) &&
              near(start(rectangles[n.children[1].id]!), next),
          );
        let id = original?.id;
        if (!id) {
          do {
            id = `${receiverId}-join-${++serial}`;
          } while (used.has(id));
          used.add(id);
        }
        return {
          kind: 'split',
          id,
          axis,
          ratio: (cut - start(region)) / (end(region) - start(region) - gap),
          ...(boundary?.gap === undefined ? {} : { gap: boundary.gap }),
          children: [left, rightNode],
        };
      }
    }
    return undefined;
  };
  const replacement = build(remaining, rectangles[ancestor.id]!);
  if (!replacement) return undefined;
  const replace = (node: Node): Node =>
    node.id === ancestor.id
      ? replacement
      : node.kind === 'group'
        ? node
        : { ...node, children: [replace(node.children[0]), replace(node.children[1])] };
  return { root: replace(root), selected, area };
}
