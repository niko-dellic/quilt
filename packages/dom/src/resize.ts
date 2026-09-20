import { bounds, DIVIDER, findNode } from 'quilt-core';
import type { Axis, Layout, Node } from 'quilt-core';

/** Resize only the branches touching a divider, preserving every farther edge. */
export function isolatedResize(
  layout: Layout,
  splitId: string,
  extent: (node: Node, axis: Axis) => number,
  measureBounds: typeof bounds = bounds,
) {
  const split = findNode(layout.root, splitId);
  if (split?.kind !== 'split') throw new Error('Split not found');
  const axis = split.axis;
  const sizes = new Map<string, number>();
  const original: Record<string, number> = {};
  function capture(node: Node) {
    sizes.set(node.id, extent(node, axis));
    if (node.kind === 'split') {
      original[node.id] = node.ratio;
      node.children.forEach(capture);
    }
  }
  capture(split);
  function limits(node: Node, start: boolean): [number, number] {
    if (node.kind === 'group') {
      const b = measureBounds(node, layout),
        size = sizes.get(node.id)!;
      return axis === 'horizontal'
        ? [b.minWidth - size, b.maxWidth - size]
        : [b.minHeight - size, b.maxHeight - size];
    }
    if (node.axis === axis) return limits(node.children[start ? 0 : 1], start);
    const a = limits(node.children[0], start),
      b = limits(node.children[1], start);
    return [Math.max(a[0], b[0]), Math.min(a[1], b[1])];
  }
  const a = limits(split.children[0], false),
    b = limits(split.children[1], true);
  const available = sizes.get(split.id)! - (split.gap ?? DIVIDER);
  return {
    original,
    ratios(ratio: number) {
      const delta = Math.max(
        Math.max(a[0], -b[1]),
        Math.min(Math.min(a[1], -b[0]), available * ratio - sizes.get(split.children[0].id)!),
      );
      const ratios: Record<string, number> = {};
      function adjust(node: Node, start: boolean, change: number) {
        if (node.kind === 'group') return;
        if (node.axis === axis) {
          const first = sizes.get(node.children[0].id)! + (start ? change : 0);
          const total = sizes.get(node.id)! + change - (node.gap ?? DIVIDER);
          ratios[node.id] = Math.max(0.001, Math.min(0.999, first / total));
          adjust(node.children[start ? 0 : 1], start, change);
        } else node.children.forEach((child) => adjust(child, start, change));
      }
      ratios[split.id] = Math.max(
        0.001,
        Math.min(0.999, (sizes.get(split.children[0].id)! + delta) / available),
      );
      adjust(split.children[0], false, delta);
      adjust(split.children[1], true, -delta);
      return ratios;
    },
  };
}
