import type { Layout, Node } from 'quilt-core';

export type Falloff = 'linear' | 'bezier' | 'quadratic';

export function falloffInfluence(distance: number, falloff: Falloff, inverted = false) {
  const t = Math.max(0, Math.min(1, distance));
  // Cubic Bézier (1/3, 0, 2/3, 1) has x(t) = t, so no iterative solver is needed.
  const curve = falloff === 'bezier' ? t * t * (3 - 2 * t) : falloff === 'quadratic' ? t * t : t;
  return inverted ? curve : 1 - curve;
}
export interface Region {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export function adaptiveGrid(rows = 6, columns = 10): Pick<Layout, 'root' | 'panes'> {
  if (![rows, columns].every((value) => Number.isInteger(value) && value >= 1))
    throw new Error('Rows and columns must each be positive whole numbers.');
  const split = (nodes: Node[], axis: 'horizontal' | 'vertical', id: string): Node => {
    if (nodes.length === 1) return nodes[0]!;
    const middle = Math.ceil(nodes.length / 2);
    return {
      kind: 'split',
      id,
      axis,
      ratio: middle / nodes.length,
      children: [
        split(nodes.slice(0, middle), axis, `${id}-a`),
        split(nodes.slice(middle), axis, `${id}-b`),
      ],
    };
  };
  const lines = Array.from({ length: rows }, (_, row) =>
    split(
      Array.from({ length: columns }, (_, col): Node => {
        const id = `adaptive-${row}-${col}`;
        return { kind: 'group', id: `group-${id}`, panes: [], active: null, tabDisplay: 'compact' };
      }),
      'horizontal',
      `adaptive-row-${row}`,
    ),
  );
  return { panes: {}, root: split(lines, 'vertical', 'adaptive-rows') };
}
export function targetAreas(
  regions: Region[],
  hovered: string,
  strength: number,
  falloff: Falloff,
  inverted = false,
  radius = 1,
) {
  const active = regions.find((region) => region.id === hovered);
  const areas: Record<string, number> = {};
  if (!active || !regions.length) return areas;
  const diagonal = Math.max(
    1,
    Math.hypot(
      Math.max(...regions.map((r) => r.x + r.width)) - Math.min(...regions.map((r) => r.x)),
      Math.max(...regions.map((r) => r.y + r.height)) - Math.min(...regions.map((r) => r.y)),
    ),
  );
  const amount = Math.max(0, Math.min(1, strength / 100));
  const neighbors = regions.filter((region) => region.id !== hovered);
  const activeArea = active.width * active.height;
  const extent = diagonal * Math.max(0, Math.min(1, radius));
  // Allocate the enlargement as a compression budget. Capping each contribution
  // keeps every neighbor positive and prevents normalization from enlarging it.
  areas[hovered] = activeArea;
  const weights = new Map<string, number>();
  const capacities = new Map<string, number>();
  for (const region of neighbors) {
    const area = region.width * region.height;
    const distance = Math.hypot(
      region.x + region.width / 2 - active.x - active.width / 2,
      region.y + region.height / 2 - active.y - active.height / 2,
    );
    areas[region.id] = area;
    if (extent <= 0 || distance >= extent) continue;
    const t = distance / extent;
    // Inverted influence still fades to zero at the radius boundary. This avoids
    // a hard discontinuity as a neighboring resting center enters the radius.
    const rim = 1 - falloffInfluence(Math.max(0, (t - 0.8) / 0.2), 'bezier', true);
    const influence = falloffInfluence(t, falloff, inverted) * rim;
    if (influence > 1e-8) {
      weights.set(region.id, area * influence);
      capacities.set(region.id, area * 0.9 * influence);
    }
  }
  let eligible = neighbors.filter((region) => weights.has(region.id));
  const capacity = eligible.reduce((sum, region) => sum + capacities.get(region.id)!, 0);
  const growth = Math.min(3 * amount * activeArea, capacity);
  areas[hovered] += growth;
  let remaining = growth;
  while (remaining > 1e-8 && eligible.length) {
    const totalWeight = eligible.reduce((sum, region) => sum + weights.get(region.id)!, 0);
    const budget = remaining;
    const next: Region[] = [];
    for (const region of eligible) {
      const capacity = capacities.get(region.id)!;
      const reduction = Math.min(capacity, (budget * weights.get(region.id)!) / totalWeight);
      areas[region.id]! -= reduction;
      capacities.set(region.id, capacity - reduction);
      remaining -= reduction;
      if (capacity - reduction > 1e-8) next.push(region);
    }
    eligible = next;
  }
  return areas;
}
// Propagate desired dimensions independently: summing areas alone makes an
// entire ten-pane row barely taller even when its hovered pane grows fourfold.
export function adaptiveRatios(root: Node, regions: Region[], areas: Record<string, number>) {
  const ratios: Record<string, number> = {};
  const measured = new Map(regions.map((region) => [region.id, region]));
  const visit = (node: Node): { width: number; height: number } => {
    if (node.kind === 'group') {
      const region = measured.get(node.id);
      if (!region) return { width: 0, height: 0 };
      const scale = Math.sqrt(
        (areas[node.id] ?? region.width * region.height) / (region.width * region.height),
      );
      return { width: region.width * scale, height: region.height * scale };
    }
    const a = visit(node.children[0]),
      b = visit(node.children[1]);
    if (!a.width || !a.height) return b;
    if (!b.width || !b.height) return a;
    if (node.axis === 'horizontal') {
      ratios[node.id] = a.width / (a.width + b.width);
      return { width: a.width + b.width, height: Math.max(a.height, b.height) };
    }
    ratios[node.id] = a.height / (a.height + b.height);
    return { width: Math.max(a.width, b.width), height: a.height + b.height };
  };
  visit(root);
  return ratios;
}
export function splitRatios(root: Node): Record<string, number> {
  if (root.kind === 'group') return {};
  return {
    [root.id]: root.ratio,
    ...splitRatios(root.children[0]),
    ...splitRatios(root.children[1]),
  };
}
