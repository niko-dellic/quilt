import { describe, it, expect } from 'vitest';
import {
  createLayout,
  LayoutError,
  LayoutStore,
  parseLayout,
  allocate,
  bounds,
  groups,
  validate,
} from 'quilt-core';
import type { Layout, Pane } from 'quilt-core';
const pane = (id: string): Pane => ({ id, type: 'test', title: id });
function fixture(): Layout {
  return {
    version: 1,
    root: {
      kind: 'split',
      id: 'root',
      axis: 'horizontal',
      ratio: 0.4,
      children: [
        { kind: 'group', id: 'a-group', panes: ['a', 'b'], active: 'a' },
        { kind: 'group', id: 'c-group', panes: ['c'], active: 'c' },
      ],
    },
    panes: { a: pane('a'), b: pane('b'), c: pane('c') },
    popouts: [],
    maximized: null,
  };
}
describe('transactional layout model', () => {
  it('round-trips snapshots and isolates caller mutation', () => {
    const input = fixture();
    const s = new LayoutStore(input);
    input.panes.a!.title = 'changed';
    const copy = s.export();
    copy.panes.a!.title = 'also changed';
    expect(s.getSnapshot().panes.a!.title).toBe('a');
    expect(parseLayout(JSON.parse(JSON.stringify(s.export())))).toEqual(fixture());
    expect(Object.isFrozen(s.getSnapshot().root)).toBe(true);
  });
  it('rejects malformed inputs without changing the current snapshot', () => {
    const s = new LayoutStore(fixture());
    const before = s.getSnapshot();
    const bad = fixture();
    bad.root = { kind: 'group', id: 'bad', panes: ['a', 'a'], active: 'a' };
    expect(() => s.load(bad)).toThrow();
    expect(s.getSnapshot()).toBe(before);
    expect(validate({ ...fixture(), version: 3 })).not.toEqual([]);
  });
  it('rejects functions, cycles, duplicate ids and nonfinite values', () => {
    expect(() => parseLayout({ ...fixture(), bad: () => {} })).toThrow();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(validate(cyclic).length).toBeGreaterThan(0);
    const bad = fixture();
    bad.panes.a!.size = { minWidth: Infinity };
    expect(validate(bad).length).toBeGreaterThan(0);
  });
  it('splits, joins and preserves every pane exactly once', () => {
    const s = new LayoutStore(fixture());
    s.split('c-group', 'vertical', pane('d'));
    expect(groups(s.getSnapshot().root)).toHaveLength(3);
    s.join('c-group');
    expect(groups(s.getSnapshot().root).find((g) => g.id === 'c-group')?.panes).toEqual(['c', 'd']);
    expect(validate(s.export())).toEqual([]);
  });
  it('moves tabs and edge-docks without creating empty branches', () => {
    const s = new LayoutStore(fixture(), { autoCollapse: 'enabled' });
    s.move('b', 'c-group', 'tab', 0);
    expect(groups(s.getSnapshot().root).find((g) => g.id === 'c-group')?.panes).toEqual(['b', 'c']);
    s.move('a', 'c-group', 'bottom');
    expect(groups(s.getSnapshot().root)).toHaveLength(2);
    expect(validate(s.export())).toEqual([]);
  });
  it('enforces user capabilities but allows host operations', () => {
    const f = fixture();
    f.panes.a!.capabilities = {
      resize: false,
      move: false,
      split: false,
      join: false,
      close: false,
      popout: false,
    };
    const s = new LayoutStore(f);
    expect(() => s.close('a', { source: 'user' })).toThrow();
    expect(() => s.resize('root', 0.6, { source: 'user' })).toThrow();
    expect(() => s.move('a', 'c-group', 'tab', undefined, { source: 'user' })).toThrow();
    expect(() => s.split('a-group', 'vertical', pane('d'), { source: 'user' })).toThrow();
    s.resize('root', 0.6);
    s.close('a');
    expect(s.getSnapshot().panes.a).toBeUndefined();
  });
  it('returns a popout after its original group disappears', () => {
    const s = new LayoutStore(fixture(), { autoCollapse: 'enabled' });
    s.popout('c');
    expect(s.getSnapshot().popouts[0]?.groupId).toBe('c-group');
    s.returnPane('c');
    expect(s.getSnapshot().popouts).toEqual([]);
    expect(groups(s.getSnapshot().root).flatMap((g) => g.panes)).toContain('c');
  });
  it('supports all panes popped out and arbitrary return order', () => {
    const s = new LayoutStore(fixture());
    for (const id of ['a', 'b', 'c']) s.popout(id);
    expect(groups(s.getSnapshot().root)[0]?.panes).toEqual([]);
    for (const id of ['c', 'b', 'a']) s.returnPane(id);
    expect(validate(s.export())).toEqual([]);
    expect(
      groups(s.getSnapshot().root)
        .flatMap((g) => g.panes)
        .sort(),
    ).toEqual(['a', 'b', 'c']);
  });
  it('clears maximize if its group is removed', () => {
    const s = new LayoutStore(fixture(), { autoCollapse: 'enabled' });
    s.maximize('c-group');
    s.close('c');
    expect(s.getSnapshot().maximized).toBe(null);
  });
  it('unsubscribes and makes disposal idempotent', () => {
    const s = new LayoutStore(fixture());
    let n = 0;
    const stop = s.subscribe(() => n++);
    s.activate('a-group', 'b');
    stop();
    s.activate('a-group', 'a');
    expect(n).toBe(1);
    s.dispose();
    s.dispose();
    expect(() => s.close('a')).toThrow(/disposed/);
  });
  it('isolates observer exceptions after a committed change', () => {
    const s = new LayoutStore(fixture());
    let seen = 0;
    s.onError(() => seen++);
    s.subscribe(() => {
      throw Error('consumer');
    });
    s.close('a');
    expect(seen).toBe(1);
    expect(s.getSnapshot().panes.a).toBeUndefined();
  });
});
describe('constraints', () => {
  it('retains minima in small viewports and caps maxima', () => {
    expect(allocate(100, 0.5, 90, Infinity, 80, Infinity)).toEqual([90, 80]);
    expect(allocate(1000, 0.8, 50, 100, 50, 200)).toEqual([100, 200]);
    expect(allocate(400, 0.9, 48, 48, 100, Infinity)).toEqual([48, 348]);
  });
  it('rejects incompatible tab constraints atomically', () => {
    const f = fixture();
    f.panes.a!.size = { minWidth: 400 };
    f.panes.b!.size = { maxWidth: 300 };
    expect(() => new LayoutStore(f)).toThrow(/cannot coexist/);
  });
  it('computes recursive constraints including dividers', () => {
    const f = fixture();
    f.panes.a!.size = { minWidth: 100, minHeight: 60 };
    f.panes.c!.size = { minWidth: 200, minHeight: 90 };
    expect(bounds(f.root, f).minWidth).toBe(304);
    expect(bounds(f.root, f).minHeight).toBe(90);
  });
  it('maintains invariants through repeated operation sequences', () => {
    const s = new LayoutStore(fixture());
    for (let i = 0; i < 60; i++) {
      s.split('a-group', i % 2 ? 'horizontal' : 'vertical', pane('extra-' + i));
      s.move('extra-' + i, 'c-group');
      s.popout('extra-' + i);
      s.returnPane('extra-' + i);
      s.close('extra-' + i);
      expect(validate(s.export())).toEqual([]);
    }
    expect(Object.keys(s.export().panes).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('configuration replacement and nested observers', () => {
  it('loads a new configuration without retaining old extra fields', () => {
    const s = new LayoutStore({ ...fixture(), extra: 'old' });
    s.load(fixture());
    expect(s.export()).toEqual(fixture());
  });
  it('delivers nested commands in commit order with matching snapshots', () => {
    const s = new LayoutStore(fixture());
    const seen: string[] = [];
    s.subscribe((event) => {
      if (event.action === 'activate') s.close('c');
    });
    s.subscribe((event) => seen.push(event.action + ':' + Object.keys(event.layout.panes).length));
    s.activate('a-group', 'b');
    expect(seen).toEqual(['activate:3', 'close:2']);
  });
  it('returns panes into a new region when existing groups have incompatible constraints', () => {
    const f = fixture();
    f.panes.a!.size = { maxWidth: 200 };
    f.panes.b!.size = { maxWidth: 200 };
    f.panes.c!.size = { minWidth: 300 };
    const s = new LayoutStore(f);
    s.popout('c');
    s.returnPane('c');
    expect(groups(s.getSnapshot().root)).toHaveLength(2);
    expect(validate(s.export())).toEqual([]);
  });
});

it('supports zero-gap geometry and directional splits without losing original panes', () => {
  const f = fixture();
  if (f.root.kind !== 'split') throw new Error('fixture');
  f.root.gap = 0;
  expect(validate(f)).toEqual([]);
  const original = bounds(f.root, f).minWidth;
  f.root.gap = 6;
  expect(bounds(f.root, f).minWidth).toBe(original + 6);
  expect(allocate(100, 0.5, 0, Infinity, 0, Infinity, 0)).toEqual([50, 50]);
  const store = new LayoutStore(f);
  store.split('a-group', 'horizontal', pane('new'), { before: true, ratio: 0.3 });
  const group = store.getSnapshot().root;
  expect(groups(group).map((g) => g.panes)).toEqual([['new'], ['a', 'b'], ['c']]);
});

it('creates an empty split before content selection and cancels without losing concurrent edits', () => {
  const store = new LayoutStore(fixture());
  const id = store.split('a-group', 'horizontal', null, { before: true, ratio: 0.3 });
  expect(groups(store.getSnapshot().root).find((g) => g.id === id)?.panes).toEqual([]);
  store.updatePane({ ...store.getSnapshot().panes.a!, title: 'Edited' });
  store.removeEmptyGroup(id);
  expect(store.getSnapshot().panes.a!.title).toBe('Edited');
  expect(groups(store.getSnapshot().root)).toHaveLength(2);
  const filled = store.split('a-group', 'vertical', null);
  store.add(pane('chosen'), filled);
  store.removeEmptyGroup(filled);
  expect(groups(store.getSnapshot().root).find((g) => g.id === filled)?.panes).toEqual(['chosen']);
  expect(validate(store.export())).toEqual([]);
});

it('coupled resize ratios validate atomically', () => {
  const store = new LayoutStore(fixture());
  const before = store.export();
  expect(() => store.resizeMany({ root: 0.7, missing: 0.4 })).toThrow();
  expect(store.export()).toEqual(before);
  expect(() => store.resizeMany({ root: NaN })).toThrow();
  expect(store.export()).toEqual(before);
});

describe('autoCollapse session policy', () => {
  for (const mode of ['enabled', 'protected', 'disabled'] as const) {
    for (const action of ['close', 'move', 'popout'] as const) {
      it(`${mode}: ${action} only collapses the emptied source when permitted`, () => {
        const s = new LayoutStore(fixture(), { autoCollapse: mode });
        const unrelated = s.split('a-group', 'vertical', null);
        s.maximize('c-group');
        if (action === 'move') s.move('c', 'a-group');
        else s[action]('c');
        const preserved = mode === 'disabled' || (mode === 'protected' && action === 'popout');
        expect(groups(s.getSnapshot().root).some((g) => g.id === 'c-group')).toBe(preserved);
        expect(groups(s.getSnapshot().root).some((g) => g.id === unrelated)).toBe(true);
        expect(s.getSnapshot().maximized).toBe(preserved ? 'c-group' : null);
        if (action === 'popout' && preserved) {
          s.returnPane('c');
          expect(groups(s.getSnapshot().root).find((g) => g.id === 'c-group')?.panes).toEqual([
            'c',
          ]);
        }
        expect(validate(s.export())).toEqual([]);
      });
    }
  }
  it('defaults to disabled and retains session settings through load and reset', () => {
    const s = new LayoutStore(fixture());
    expect(s.getAutoCollapse()).toBe('disabled');
    s.close('c');
    expect(groups(s.getSnapshot().root).find((g) => g.id === 'c-group')?.panes).toEqual([]);
    s.setAutoCollapse('enabled');
    expect(groups(s.getSnapshot().root)).toHaveLength(2);
    s.load(fixture());
    s.reset();
    expect(s.getAutoCollapse()).toBe('enabled');
    expect(s.export()).not.toHaveProperty('autoCollapse');
    const before = s.getSnapshot();
    // @ts-expect-error Invalid runtime input must be rejected.
    expect(() => s.setAutoCollapse(false)).toThrow(/autoCollapse/);
    // @ts-expect-error Invalid constructor input must be rejected.
    expect(() => new LayoutStore(fixture(), { autoCollapse: 'invalid' })).toThrow(/autoCollapse/);
    expect(s.getAutoCollapse()).toBe('enabled');
    expect(s.getSnapshot()).toBe(before);
  });
  it('explicit removal preserves detached content and protects the final root', () => {
    const s = new LayoutStore(fixture());
    s.popout('c');
    s.removeEmptyGroup('c-group');
    expect(s.getSnapshot().panes.c).toBeDefined();
    s.returnPane('c');
    for (const id of ['a', 'b', 'c']) s.close(id);
    const before = s.getSnapshot();
    s.removeEmptyGroup(before.root.id);
    expect(s.getSnapshot()).toBe(before);
  });
  it('joining and closing detached tabs preserve unrelated empty groups', () => {
    const s = new LayoutStore(fixture(), { autoCollapse: 'protected' });
    s.popout('c');
    s.split('a-group', 'vertical', pane('d'));
    s.join('a-group');
    s.close('c');
    expect(groups(s.getSnapshot().root).find((g) => g.id === 'c-group')?.panes).toEqual([]);
  });
});

it('persists region tab placement and rejects invalid updates atomically', () => {
  const store = new LayoutStore(fixture());
  store.setTabPlacement('a-group', 'left');
  const saved = store.export();
  const restored = new LayoutStore(JSON.parse(JSON.stringify(saved)));
  expect(groups(restored.getSnapshot().root).map((g) => g.tabPlacement)).toEqual([
    'left',
    undefined,
  ]);
  expect(() => store.setTabPlacement('root', 'top')).toThrow();
  expect(() => store.setTabPlacement('a-group', 'invalid' as 'top')).toThrow();
  expect(store.export()).toEqual(saved);
  restored.setTabPlacement('a-group', undefined);
  expect(restored.export()).toEqual(fixture());
});

it('persists tab display independently of orientation and validates atomically', () => {
  const store = new LayoutStore(fixture());
  store.setTabDisplay('a-group', 'compact');
  store.setTabPlacement('a-group', 'left');
  const saved = store.export();
  const restored = new LayoutStore(JSON.parse(JSON.stringify(saved)));
  expect(groups(restored.getSnapshot().root)[0]).toMatchObject({
    tabDisplay: 'compact',
    tabPlacement: 'left',
  });
  expect(() => store.setTabDisplay('a-group', 'bad' as 'compact')).toThrow();
  expect(store.export()).toEqual(saved);
  restored.setTabDisplay('a-group', undefined);
  expect(groups(restored.getSnapshot().root)[0]!.tabDisplay).toBeUndefined();
});

it('restores closed tabs in order without undoing subsequent edits', () => {
  const store = new LayoutStore(fixture());
  store.close('a');
  store.close('b');
  store.setTabDisplay('a-group', 'compact');
  store.restoreClosedTab();
  expect(groups(store.getSnapshot().root)[0]).toMatchObject({
    panes: ['b'],
    active: 'b',
    tabDisplay: 'compact',
  });
  store.restoreClosedTab();
  expect(groups(store.getSnapshot().root)[0]!.panes).toEqual(['a', 'b']);
  expect(store.canRestoreClosedTab()).toBe(false);
  store.close('a');
  store.load(fixture());
  expect(store.canRestoreClosedTab()).toBe(false);
});
it('restores closed tabs after their original region collapses', () => {
  const store = new LayoutStore(fixture(), { autoCollapse: 'enabled' });
  store.close('c');
  store.restoreClosedTab();
  expect(store.getSnapshot().panes.c).toEqual(pane('c'));
  expect(groups(store.getSnapshot().root).flatMap((g) => g.panes)).toContain('c');
});
it('failed close does not create restore history', () => {
  const input = fixture();
  input.panes.a!.capabilities = { close: false };
  const store = new LayoutStore(input);
  expect(() => store.close('a', { source: 'user' })).toThrow();
  expect(store.canRestoreClosedTab()).toBe(false);
});

it('closes a region atomically and retains its closed tabs for restore', () => {
  const input = fixture();
  input.panes.b!.capabilities = { close: false };
  const store = new LayoutStore(input);
  expect(() => store.closeGroup('a-group', { source: 'user' })).toThrow();
  expect(store.export()).toEqual(input);
  expect(store.canRestoreClosedTab()).toBe(false);
  store.closeGroup('a-group');
  expect(store.getSnapshot().root.id).toBe('c-group');
  expect(Object.keys(store.getSnapshot().panes)).toEqual(['c']);
  store.restoreClosedTab();
  store.restoreClosedTab();
  expect(Object.keys(store.getSnapshot().panes).sort()).toEqual(['a', 'b', 'c']);
  store.closeGroup('c-group');
  expect(groups(store.getSnapshot().root)[0]!.panes).toEqual([]);
});

describe('createLayout', () => {
  it('creates independent empty layouts with stable group IDs', () => {
    const first = createLayout();
    expect(first).toEqual({
      version: 1,
      root: { kind: 'group', id: 'main', panes: [], active: null },
      panes: {},
      popouts: [],
      maximized: null,
    });
    first.root.id = 'changed';
    expect(createLayout().root.id).toBe('main');
    expect(createLayout({ groupId: 'custom' }).root.id).toBe('custom');
  });
  it('clones pane metadata and activates the supplied pane', () => {
    const input: Pane = { ...pane('notes'), params: { text: 'original' } };
    const layout = createLayout({ pane: input, groupId: 'editor' });
    expect(layout.root).toEqual({ kind: 'group', id: 'editor', panes: ['notes'], active: 'notes' });
    expect(layout.panes.notes).toEqual(input);
    expect(layout.panes.notes).not.toBe(input);
    layout.panes.notes!.params = 'edited';
    expect(input.params).toEqual({ text: 'original' });
    expect(createLayout({ pane: input }).panes.notes!.params).toEqual({ text: 'original' });
  });
  it('uses LayoutError for invalid IDs and metadata', () => {
    expect(() => createLayout({ groupId: '' })).toThrow(LayoutError);
    expect(() => createLayout({ pane: { ...pane(''), params: NaN } })).toThrow(LayoutError);
    expect(() => createLayout({ pane: { ...pane('a'), size: { minWidth: -1 } } })).toThrow(
      LayoutError,
    );
  });
});

describe('scoped capability policy', () => {
  it('resolves tab, saved tab, region, and workspace settings in order', () => {
    const layout = fixture();
    layout.panes.a!.capabilities = { close: false };
    const store = new LayoutStore(layout, {
      capabilities: {
        defaults: { close: false, move: false },
        groups: { 'a-group': { close: true } },
        panes: { a: { close: true } },
      },
    });
    expect(store.can('a', 'close')).toBe(true);
    expect(store.can('b', 'close')).toBe(true);
    expect(store.can('c', 'close')).toBe(false);
    expect(store.can('a', 'move')).toBe(false);
    expect(store.can('missing', 'close')).toBe(false);
    store.setCapabilities({ defaults: { close: false }, groups: { 'a-group': { close: true } } });
    expect(store.can('a', 'close')).toBe(false);
    expect(store.canNode('a-group', 'close')).toBe(false);
    expect(() => store.closeGroup('a-group', { source: 'user' })).toThrow();
    expect(store.export()).toEqual(layout);
    store.closeGroup('a-group'); // Explicit host commands keep their authority.
    expect(store.getSnapshot().panes.a).toBeUndefined();
  });

  it('checks empty regions and all affected resize/move targets', () => {
    const layout = fixture();
    const store = new LayoutStore(layout, {
      capabilities: { defaults: { resize: false, move: false, close: false, split: false } },
    });
    expect(() => store.resize('root', 0.6, { source: 'user' })).toThrow();
    expect(() => store.move('a', 'c-group', 'tab', undefined, { source: 'user' })).toThrow();
    store.close('c');
    expect(store.canNode('c-group', 'close')).toBe(false);
    expect(() => store.removeEmptyGroup('c-group', { source: 'user' })).toThrow();
    expect(() => store.split('c-group', 'vertical', null, { source: 'user' })).toThrow();
    store.setCapabilities({ defaults: { close: false }, groups: { 'c-group': { close: true } } });
    store.removeEmptyGroup('c-group', { source: 'user' });
    expect(store.getSnapshot().root.id).toBe('a-group');
  });

  it('keeps policy out of saved layouts and validates replacements atomically', () => {
    const policy = { defaults: { move: false } };
    const store = new LayoutStore(fixture(), { capabilities: policy });
    policy.defaults.move = true;
    expect(store.can('a', 'move')).toBe(false);
    expect(() => store.setCapabilities({ defaults: { move: 'no' } } as never)).toThrow();
    store.load(store.export());
    expect(store.can('a', 'move')).toBe(false);
    expect(store.export()).toEqual(fixture());
    store.setCapabilities();
    expect(store.can('a', 'move')).toBe(true);
  });
});

describe('independent tab and maximize capabilities', () => {
  it('allows reordering and adding while blocking cross-region movement', () => {
    const store = new LayoutStore(fixture(), {
      capabilities: { defaults: { move: false, reorder: true, addTab: true } },
    });
    store.move('a', 'a-group', 'tab', 1, { source: 'user' });
    expect(groups(store.getSnapshot().root)[0]!.panes).toEqual(['b', 'a']);
    store.add(pane('d'), 'a-group', { source: 'user' });
    expect(() => store.move('a', 'c-group', 'tab', undefined, { source: 'user' })).toThrow();
    expect(() => store.move('a', 'a-group', 'left', undefined, { source: 'user' })).toThrow();
  });
  it('allows moving while blocking reorder and creation, and preserves legacy fallback', () => {
    const store = new LayoutStore(fixture(), {
      capabilities: { defaults: { move: true, reorder: false, addTab: false } },
    });
    expect(() => store.move('a', 'a-group', 'tab', 1, { source: 'user' })).toThrow();
    expect(() => store.add(pane('d'), 'a-group', { source: 'user' })).toThrow();
    store.move('a', 'c-group', 'tab', undefined, { source: 'user' });
    store.setCapabilities({ defaults: { move: false } });
    expect(store.can('a', 'addTab')).toBe(false);
    expect(store.can('a', 'reorder')).toBe(false);
  });
  it('checks maximize scope, permits restore, and validates serializable flags', () => {
    const layout = fixture();
    layout.panes.a!.capabilities = { maximize: false, reorder: true, addTab: false };
    const store = new LayoutStore(layout);
    expect(() => store.maximize('a-group', { source: 'user' })).toThrow();
    store.setCapabilities({ panes: { a: { maximize: true } } });
    store.maximize('a-group', { source: 'user' });
    store.setCapabilities({ defaults: { maximize: false } });
    store.maximize(null, { source: 'user' });
    expect(store.getSnapshot().maximized).toBeNull();
    expect(parseLayout(store.export()).panes.a!.capabilities?.reorder).toBe(true);
  });
  it('applies popout policy independently and allows returning after it is disabled', () => {
    const store = new LayoutStore(fixture(), {
      capabilities: { defaults: { popout: false, move: false }, panes: { a: { popout: true } } },
    });
    expect(() => store.popout('c', {}, { source: 'user' })).toThrow();
    store.popout('a', {}, { source: 'user' });
    store.setCapabilities({ defaults: { popout: false } });
    store.returnPane('a');
    expect(store.getSnapshot().popouts).toHaveLength(0);
    expect(store.getSnapshot().panes.a).toBeDefined();
  });
});
