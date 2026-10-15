import { expect, it } from 'vitest';
import { groups, joinRectangle, LayoutStore, validate } from 'quilt-core';
import type { Layout, Node, RegionRect } from 'quilt-core';

function grid(gap = 0): Layout {
  const split = (id: string, children: Node[], axis: 'horizontal' | 'vertical'): Node =>
    children.length === 1
      ? children[0]!
      : {
          kind: 'split',
          id,
          axis,
          gap,
          ratio: 1 / children.length,
          children: [children[0]!, split(`${id}-tail`, children.slice(1), axis)],
        };
  const rows = Array.from({ length: 3 }, (_, r) =>
    split(
      `row-${r}`,
      Array.from({ length: 3 }, (_, c): Node => ({
        kind: 'group',
        id: `${r}-${c}`,
        panes: [`p${r}-${c}`],
        active: `p${r}-${c}`,
      })),
      'horizontal',
    ),
  );
  const root = split('root', rows, 'vertical');
  return {
    version: 1,
    root,
    maximized: null,
    popouts: [],
    panes: Object.fromEntries(
      groups(root).map((g) => [g.active!, { id: g.active!, title: g.id, type: 'test' }]),
    ),
  };
}
function measure(root: Node) {
  const rects: Record<string, RegionRect> = {};
  const visit = (n: Node, r: RegionRect) => {
    rects[n.id] = r;
    if (n.kind === 'group') return;
    const gap = n.gap ?? 4,
      horizontal = n.axis === 'horizontal';
    const size = ((horizontal ? r.width : r.height) - gap) * n.ratio;
    visit(n.children[0], horizontal ? { ...r, width: size } : { ...r, height: size });
    visit(
      n.children[1],
      horizontal
        ? { ...r, left: r.left + size + gap, width: r.width - size - gap }
        : { ...r, top: r.top + size + gap, height: r.height - size - gap },
    );
  };
  visit(root, { left: 10, top: 20, width: 900, height: 900 });
  return rects;
}
for (const gap of [0, 6]) {
  it(`merges a 2x2 block across row parents and preserves outside geometry (gap ${gap})`, () => {
    const layout = grid(gap),
      rectangles = measure(layout.root);
    const store = new LayoutStore(layout);
    store.joinRegions('1-1', '0-0', { rectangles });
    const result = store.export(),
      after = measure(result.root);
    expect(validate(result)).toEqual([]);
    expect(groups(result.root)).toHaveLength(6);
    expect(groups(result.root).find((g) => g.id === '1-1')).toMatchObject({
      panes: ['p0-0', 'p0-1', 'p1-0', 'p1-1'],
      active: 'p1-1',
    });
    for (const id of ['0-2', '1-2', '2-0', '2-1', '2-2'])
      for (const key of ['left', 'top', 'width', 'height'] as const)
        expect(after[id]![key]).toBeCloseTo(rectangles[id]![key], 7);
    expect(result.panes).toEqual(layout.panes);
  });
}
it('supports vertical neighbors, reverse diagonals, and full-grid joins', () => {
  for (const [a, b, count] of [
    ['0-0', '1-0', 2],
    ['0-1', '1-0', 4],
    ['0-0', '2-2', 9],
  ] as const) {
    const layout = grid();
    const plan = joinRectangle(layout.root, a, b, measure(layout.root));
    expect(plan?.selected).toHaveLength(count);
  }
});
it('rejects partially intersected panes, invalid measurements and endpoints', () => {
  const layout = grid();
  const row = (layout.root as import('quilt-core').Split).children[0] as import('quilt-core').Split;
  row.ratio = 0.6;
  const rectangles = measure(layout.root);
  expect(joinRectangle(layout.root, '0-0', '1-0', rectangles)).toBeUndefined();
  expect(joinRectangle(layout.root, 'missing', '1-0', rectangles)).toBeUndefined();
  expect(joinRectangle(layout.root, '0-0', '0-0', rectangles)).toBeUndefined();
  expect(
    joinRectangle(layout.root, '0-0', '1-1', {
      ...rectangles,
      root: { ...rectangles.root!, width: NaN },
    }),
  ).toBeUndefined();
});
it('checks every selected permission and content constraint atomically', () => {
  for (const constraint of [false, true]) {
    const layout = grid();
    if (constraint) {
      layout.panes['p0-1']!.size = { minWidth: 200 };
      layout.panes['p1-0']!.size = { maxWidth: 100 };
    } else layout.panes['p0-1']!.capabilities = { join: false };
    const store = new LayoutStore(layout),
      before = store.getSnapshot();
    expect(() =>
      store.joinRegions('1-1', '0-0', { rectangles: measure(layout.root), source: 'user' }),
    ).toThrow();
    expect(store.getSnapshot()).toBe(before);
  }
});

it('preserves receiver settings, maximization and detached content', () => {
  const layout = grid();
  const receiver = groups(layout.root).find((g) => g.id === '1-1')!;
  receiver.tabDisplay = 'compact';
  receiver.tabPlacement = 'left';
  receiver.active = null;
  receiver.panes = [];
  layout.popouts = [{ paneId: 'p1-1', groupId: '1-1', index: 0 }];
  layout.maximized = '0-0';
  const store = new LayoutStore(layout);
  store.joinRegions('1-1', '0-0', { rectangles: measure(layout.root) });
  const result = store.export();
  expect(result.maximized).toBe('1-1');
  expect(result.popouts).toEqual(layout.popouts);
  expect(groups(result.root).find((g) => g.id === '1-1')).toMatchObject({
    tabDisplay: 'compact',
    tabPlacement: 'left',
    active: 'p0-0',
  });
  store.returnPane('p1-1');
  expect(groups(store.export().root).find((g) => g.id === '1-1')!.panes).toContain('p1-1');
});
it('rejects a merged rectangle exceeding a pane size limit', () => {
  const layout = grid();
  layout.panes['p0-0']!.size = { maxWidth: 300 };
  const store = new LayoutStore(layout),
    before = store.getSnapshot();
  expect(() => store.joinRegions('1-1', '0-0', { rectangles: measure(layout.root) })).toThrow(
    'size constraints',
  );
  expect(store.getSnapshot()).toBe(before);
});
