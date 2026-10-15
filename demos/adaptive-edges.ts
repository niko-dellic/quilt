import { allocate, bounds, type Layout, type Node } from 'quilt-core';

// Demo-owned, normalized divider positions. Aligned dividers share a position;
// hover can redistribute the space around them but cannot move that boundary.
export function anchoredRatios(
  layout: Layout,
  root: Node,
  ratios: Record<string, number>,
  anchors: ReadonlyMap<string, number>,
  width: number,
  height: number,
  positions?: Map<string, number>,
  threshold = 0,
  minimums?: ReadonlyMap<string, { width: number; height: number }>,
) {
  if (!anchors.size && !positions && !minimums) return ratios;
  const result = { ...ratios };
  const constraints = new Map<string, ReturnType<typeof bounds>>();
  const size = (node: Node) => {
    let value = constraints.get(node.id);
    if (!value) {
      value = bounds(node, layout, (group, native) => {
        const floor = minimums?.get(group.id);
        return {
          ...native,
          minWidth: Math.max(native.minWidth, Math.min(native.maxWidth, floor?.width ?? 1)),
          minHeight: Math.max(native.minHeight, Math.min(native.maxHeight, floor?.height ?? 1)),
        };
      });
      constraints.set(node.id, value);
    }
    return value;
  };
  // Propagate the space needed on BOTH sides of every fixed descendant.
  // A one-pixel gap around an anchor is insufficient for a whole subtree.
  type Limit = { start: number; end: number };
  const limits = new Map<string, { horizontal: Limit; vertical: Limit }>();
  const collect = (node: Node): { horizontal: Limit; vertical: Limit } => {
    const result = {
      horizontal: { start: Infinity, end: -Infinity },
      vertical: { start: Infinity, end: -Infinity },
    };
    if (node.kind === 'split') {
      const a = collect(node.children[0]),
        b = collect(node.children[1]);
      for (const axis of ['horizontal', 'vertical'] as const) {
        const gap = node.axis === axis ? (node.gap ?? 0) : 0;
        const first =
          node.axis === axis
            ? axis === 'horizontal'
              ? size(node.children[0]).minWidth
              : size(node.children[0]).minHeight
            : 0;
        const second =
          node.axis === axis
            ? axis === 'horizontal'
              ? size(node.children[1]).minWidth
              : size(node.children[1]).minHeight
            : 0;
        result[axis] = {
          start: Math.min(a[axis].start, b[axis].start - first - gap),
          end: Math.max(a[axis].end + second + gap, b[axis].end),
        };
        const anchor = anchors.get(node.id);
        if (node.axis === axis && anchor !== undefined) {
          const p = anchor * (axis === 'horizontal' ? width : height);
          result[axis].start = Math.min(result[axis].start, p - gap / 2 - first);
          result[axis].end = Math.max(result[axis].end, p + gap / 2 + second);
        }
      }
    }
    limits.set(node.id, result);
    return result;
  };
  collect(root);
  const walk = (node: Node, x: number, y: number, w: number, h: number) => {
    if (node.kind !== 'split') return;
    const horizontal = node.axis === 'horizontal';
    const total = horizontal ? w : h;
    const gap = node.gap ?? 0;
    const position = anchors.get(node.id);
    let ratio =
      position === undefined
        ? (result[node.id] ?? node.ratio)
        : (position * (horizontal ? width : height) - (horizontal ? x : y) - gap / 2) /
          Math.max(1, total - gap);
    // Keep enough room for every leaf around fixed descendant boundaries.
    const origin = horizontal ? x : y;
    const requested = origin + ratio * (total - gap) + gap / 2;
    const low = limits.get(node.children[0].id)![node.axis].end + gap / 2;
    const high = limits.get(node.children[1].id)![node.axis].start - gap / 2;
    // Compare with the last committed target, not the preceding pointer event.
    // Small changes accumulate until they cross the deadband; they cannot drift.
    const previous = positions?.get(node.id);
    const held =
      position === undefined &&
      previous !== undefined &&
      Math.abs(requested - previous) < threshold;
    const constrained = Math.max(low, Math.min(high, held ? previous : requested));
    ratio = (constrained - origin - gap / 2) / Math.max(1, total - gap);
    const a = size(node.children[0]),
      b = size(node.children[1]);
    const [first, second] = allocate(
      total,
      ratio,
      horizontal ? a.minWidth : a.minHeight,
      horizontal ? a.maxWidth : a.maxHeight,
      horizontal ? b.minWidth : b.minHeight,
      horizontal ? b.maxWidth : b.maxHeight,
      gap,
    );
    if (node.id in ratios || position !== undefined)
      result[node.id] = Math.max(0.001, Math.min(0.999, first / Math.max(1, first + second)));
    positions?.set(node.id, origin + first + gap / 2);
    walk(node.children[0], x, y, horizontal ? first : w, horizontal ? h : first);
    walk(
      node.children[1],
      horizontal ? x + first + gap : x,
      horizontal ? y : y + first + gap,
      horizontal ? second : w,
      horizontal ? h : second,
    );
  };
  walk(root, 0, 0, width, height);
  return result;
}
