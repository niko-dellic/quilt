import { anchoredRatios } from '../../demos/adaptive-edges.js';
import { createLayout, groups } from 'quilt-core';
import { describe, expect, it } from 'vitest';
import {
  adaptiveGrid,
  falloffInfluence,
  adaptiveRatios,
  splitRatios,
  targetAreas,
} from '../../demos/adaptive-layout.js';
import type { Node } from 'quilt-core';
const regions = [0, 1, 2].map((i) => ({
  id: String(i),
  x: i * 100,
  y: 0,
  width: 100,
  height: 100,
}));
describe('adaptive demo geometry', () => {
  it('creates 60 genuine empty regions and 59 dividers', () => {
    const grid = adaptiveGrid();
    expect(grid.panes).toEqual({});
    expect(groups(grid.root)).toHaveLength(60);
    expect(
      groups(grid.root).every((group) => group.panes.length === 0 && group.active === null),
    ).toBe(true);
    expect(Object.keys(splitRatios(grid.root))).toHaveLength(59);
    expect(adaptiveGrid()).toEqual(grid);
  });
  it('supports custom grid dimensions and rejects invalid sizes', () => {
    expect(groups(adaptiveGrid(3, 5).root)).toHaveLength(15);
    expect(adaptiveGrid(1, 1).root.kind).toBe('group');
    expect(() => adaptiveGrid(0, 10)).toThrow();
    expect(() => adaptiveGrid(2.5, 10)).toThrow();
  });
  it('preserves total area and reverses which neighbors compress most', () => {
    const linear = targetAreas(regions, '0', 20, 'linear');
    const inverted = targetAreas(regions, '0', 20, 'linear', true);
    for (const result of [linear, inverted]) {
      expect(Object.values(result).reduce((a, b) => a + b, 0)).toBeCloseTo(30000);
      expect(result['0']).toBeGreaterThan(10000);
      expect(result['1']).toBeLessThan(10000);
      expect(result['2']).toBeLessThan(10000);
    }
    expect(linear['1']).toBeLessThan(linear['2']!);
    expect(inverted['1']).toBeGreaterThan(inverted['2']!);
  });
  it('caps enlargement at four times and keeps even distant neighbors smaller', () => {
    const grid = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      x: (i % 10) * 100,
      y: Math.floor(i / 10) * 100,
      width: 100,
      height: 100,
    }));
    for (const falloff of ['linear', 'bezier', 'quadratic'] as const) {
      const result = targetAreas(grid, '44', 100, falloff);
      expect(result['44']).toBe(40000);
      expect(
        Object.entries(result)
          .filter(([id]) => id !== '44')
          .every(([, area]) => area < 10000 && area > 0),
      ).toBe(true);
      expect(Object.values(result).reduce((a, b) => a + b, 0)).toBeCloseTo(1000000);
    }
  });
  it('curves distance smoothly and independently reverses every falloff', () => {
    expect(falloffInfluence(0.25, 'linear')).toBe(0.75);
    expect(falloffInfluence(0.25, 'bezier')).toBe(0.84375);
    expect(falloffInfluence(0.25, 'quadratic')).toBe(0.9375);
    for (const curve of ['linear', 'bezier', 'quadratic'] as const) {
      expect(falloffInfluence(0, curve)).toBe(1);
      expect(falloffInfluence(1, curve)).toBe(0);
      expect(falloffInfluence(0.25, curve, true)).toBe(1 - falloffInfluence(0.25, curve));
      for (const inverted of [false, true]) {
        const areas = targetAreas(regions, '0', 20, curve, inverted);
        expect(Object.values(areas).reduce((a, b) => a + b, 0)).toBeCloseTo(30000);
        expect(areas['1']! < areas['2']!).toBe(!inverted);
        expect(targetAreas(regions, '0', 0, curve, inverted)).toEqual({
          '0': 10000,
          '1': 10000,
          '2': 10000,
        });
      }
    }
  });
  it('keeps zero strength neutral and tolerates absent targets', () => {
    expect(targetAreas(regions, '0', 0, 'linear')).toEqual({ '0': 10000, '1': 10000, '2': 10000 });
    expect(targetAreas(regions, 'missing', 65, 'linear')).toEqual({});
  });
  it('calculates subtree area ratios on edited trees without changing shell splits', () => {
    const group = (id: string): Node => ({ kind: 'group', id, panes: [], active: null });
    const root: Node = {
      kind: 'split',
      id: 'shell',
      axis: 'vertical',
      ratio: 0.1,
      children: [
        group('toolbar'),
        {
          kind: 'split',
          id: 'edited',
          axis: 'horizontal',
          ratio: 0.5,
          children: [
            group('joined'),
            {
              kind: 'split',
              id: 'new',
              axis: 'vertical',
              ratio: 0.5,
              children: [group('a'), group('b')],
            },
          ],
        },
      ],
    };
    const dimensions = [
      { id: 'joined', x: 0, y: 0, width: 10, height: 10 },
      { id: 'a', x: 10, y: 0, width: 10, height: 5 },
      { id: 'b', x: 10, y: 5, width: 10, height: 5 },
    ];
    expect(adaptiveRatios(root, dimensions, { joined: 100, a: 50, b: 50 })).toEqual({
      edited: 0.5,
      new: 0.5,
    });
    const enlarged = adaptiveRatios(root, dimensions, { joined: 100, a: 200, b: 50 });
    expect(enlarged.edited).toBeCloseTo(1 / 3);
    expect(enlarged.new).toBeCloseTo(2 / 3);
  });
});

// The demo records edges in workspace coordinates, not parent-relative ratios.
describe('adaptive manual boundaries', () => {
  it.each(['horizontal', 'vertical'] as const)(
    'keeps a nested %s edge fixed when its parent adapts',
    (axis) => {
      const group = (id: string): Node => ({ kind: 'group', id, panes: [], active: null });
      const root: Node = {
        kind: 'split',
        id: 'outer',
        axis,
        gap: 0,
        ratio: 0.6,
        children: [
          {
            kind: 'split',
            id: 'inner',
            axis,
            gap: 0,
            ratio: 0.5,
            children: [group('a'), group('b')],
          },
          group('c'),
        ],
      };
      const layout = { ...createLayout(), root };
      const anchors = new Map([['inner', 0.3]]);
      for (const ratio of [0.7, 0.4, 0.2]) {
        const result = anchoredRatios(
          layout,
          root,
          { outer: ratio, inner: 0.8 },
          anchors,
          1000,
          1000,
        );
        expect(result.outer! * result.inner!).toBeCloseTo(0.3, 6);
      }
    },
  );
  it('leaves layouts without manually fixed edges untouched', () => {
    const layout = createLayout();
    const ratios = {};
    expect(anchoredRatios(layout, layout.root, ratios, new Map(), 1000, 600)).toBe(ratios);
  });
});

it('holds sub-threshold edges until accumulated movement crosses the deadband', () => {
  const grid = adaptiveGrid(1, 2);
  const root = { ...grid.root, gap: 0 } as Node;
  const layout = { ...createLayout(), ...grid, root };
  const positions = new Map<string, number>();
  const solve = (ratio: number, threshold = 2) =>
    anchoredRatios(
      layout,
      root,
      { 'adaptive-row-0': ratio },
      new Map(),
      1000,
      600,
      positions,
      threshold,
    )['adaptive-row-0'];
  expect(solve(0.5)).toBe(0.5);
  expect(solve(0.501)).toBe(0.5);
  expect(solve(0.5019)).toBe(0.5);
  expect(solve(0.503)).toBe(0.503);
  expect(solve(0.502)).toBe(0.503);
  // Returning to rest and manual interaction bypass the deadband.
  expect(solve(0.502, 0)).toBe(0.502);
});

it('reserves a whole leaf beside a fixed descendant instead of crushing it to one pixel', () => {
  const group = (id: string): Node => ({ kind: 'group', id, panes: [], active: null });
  const root: Node = {
    kind: 'split',
    id: 'rows',
    axis: 'vertical',
    gap: 0,
    ratio: 0.6,
    children: [
      {
        kind: 'split',
        id: 'fixed',
        axis: 'vertical',
        gap: 0,
        ratio: 0.5,
        children: [group('a'), group('b')],
      },
      group('c'),
    ],
  };
  const layout = { ...createLayout(), root };
  const minimums = new Map(['a', 'b', 'c'].map((id) => [id, { width: 24, height: 24 }]));
  const result = anchoredRatios(
    layout,
    root,
    { rows: 0.2, fixed: 0.5 },
    new Map([['fixed', 0.3]]),
    1000,
    1000,
    new Map(),
    2,
    minimums,
  );
  const firstSubtree = result.rows! * 1000;
  const firstRow = result.fixed! * firstSubtree;
  expect(firstRow).toBeCloseTo(300);
  expect(firstSubtree - firstRow).toBeGreaterThanOrEqual(24 - 1e-8);
  expect(1000 - firstSubtree).toBeGreaterThanOrEqual(24);
});

it.each(['linear', 'bezier', 'quadratic'] as const)(
  'limits %s influence to the radius and preserves area',
  (falloff) => {
    for (const inverted of [false, true]) {
      const result = targetAreas(regions, '0', 100, falloff, inverted, 0.5);
      expect(result['2']).toBe(10000);
      expect(result['1']).toBeLessThan(10000);
      expect(result['0']).toBeGreaterThan(10000);
      expect(Object.values(result).reduce((a, b) => a + b, 0)).toBeCloseTo(30000);
      expect(targetAreas(regions, '0', 100, falloff, inverted, 0.1)).toEqual({
        '0': 10000,
        '1': 10000,
        '2': 10000,
      });
      // A tiny radius change cannot suddenly consume an entire new neighbor.
      const justInside = 100.01 / Math.hypot(300, 100);
      expect(
        targetAreas(regions, '0', 100, falloff, inverted, justInside)['0']! - 10000,
      ).toBeLessThan(0.01);
    }
  },
);
