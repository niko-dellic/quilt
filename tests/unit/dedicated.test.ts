import { describe, it, expect } from 'vitest';
import { LayoutStore, groups, parseLayout, joinRange, joinRectangle } from 'quilt-core';
import type { Layout } from 'quilt-core';
function fixture(): Layout {
  return {
    version: 1,
    maximized: null,
    popouts: [],
    root: {
      kind: 'split',
      id: 'root',
      axis: 'horizontal',
      ratio: 0.5,
      children: [
        { kind: 'group', id: 'left', panes: ['a', 'b'], active: 'a' },
        { kind: 'group', id: 'right', panes: ['c'], active: 'c' },
      ],
    },
    panes: Object.fromEntries(['a', 'b', 'c'].map((id) => [id, { id, type: 'test', title: id }])),
  };
}
const group = (store: LayoutStore, id = 'left') =>
  groups(store.getSnapshot().root).find((g) => g.id === id)!;
describe('dedicated regions', () => {
  it('closes inactive views in one commit, round-trips, and restores elsewhere', () => {
    const store = new LayoutStore(fixture());
    const events: string[] = [];
    store.subscribe((e) => events.push(e.action));
    store.dedicateGroup('left');
    expect(events).toEqual(['dedicateGroup']);
    expect(group(store)).toMatchObject({ panes: ['a'], active: 'a', dedicatedPaneId: 'a' });
    expect(parseLayout(JSON.parse(JSON.stringify(store.export())))).toEqual(store.export());
    store.restoreClosedTab();
    expect(group(store).panes).toEqual(['a']);
    expect(group(store, 'right').panes).toContain('b');
    store.releaseGroup('left');
    expect(group(store).dedicatedPaneId).toBeUndefined();
    store.move('b', 'left');
    expect(group(store).panes).toEqual(['a', 'b']);
  });
  it('checks only inactive close permissions, with no partial changes on failure', () => {
    const store = new LayoutStore(fixture(), { capabilities: { panes: { b: { close: false } } } });
    const before = store.getSnapshot();
    expect(() => store.dedicateGroup('left', { source: 'user' })).toThrow();
    expect(store.getSnapshot()).toBe(before);
    expect(store.canRestoreClosedTab()).toBe(false);
    store.setCapabilities({ panes: { a: { close: false } } });
    store.dedicateGroup('left', { source: 'user' });
    expect(group(store).panes).toEqual(['a']);
  });
  it('rejects invalid saved dedication and tab additions, while allowing joins', () => {
    const invalid = fixture();
    if (invalid.root.kind === 'split' && invalid.root.children[0].kind === 'group')
      invalid.root.children[0].dedicatedPaneId = 'a';
    expect(() => parseLayout(invalid)).toThrow();
    const store = new LayoutStore(fixture());
    store.dedicateGroup('left');
    const before = store.getSnapshot();
    for (const action of [
      () => store.add({ id: 'd', type: 'test', title: 'D' }, 'left'),
      () => store.move('c', 'left'),
    ]) {
      expect(action).toThrow();
      expect(store.getSnapshot()).toBe(before);
    }
    expect(store.canNode('left', 'addTab')).toBe(false);
    expect(store.canNode('root', 'join')).toBe(true);
    expect(joinRange(before.root, 'left', 'right')).toBeDefined();
    expect(
      joinRectangle(before.root, 'left', 'right', {
        root: { left: 0, top: 0, width: 200, height: 100 },
        left: { left: 0, top: 0, width: 100, height: 100 },
        right: { left: 100, top: 0, width: 100, height: 100 },
      }),
    ).toBeDefined();
    store.split('left', 'vertical', null);
    expect(group(store).dedicatedPaneId).toBe('a');
  });
  it.each(['disabled', 'protected', 'enabled'] as const)(
    'handles popout and return with %s collapse',
    (autoCollapse) => {
      const store = new LayoutStore(fixture(), { autoCollapse });
      store.dedicateGroup('left');
      store.popout('a');
      expect(parseLayout(store.export())).toEqual(store.export());
      if (autoCollapse !== 'enabled') {
        expect(group(store)).toMatchObject({ panes: [], dedicatedPaneId: 'a' });
        expect(() => store.move('c', 'left')).toThrow();
      }
      store.restoreClosedTab();
      store.returnPane('a');
      if (autoCollapse !== 'enabled')
        expect(group(store)).toMatchObject({ panes: ['a'], dedicatedPaneId: 'a' });
      expect(parseLayout(store.export())).toEqual(store.export());
    },
  );
  it.each(['move', 'close', 'closeGroup', 'closePopout'] as const)(
    'clears dedication after %s',
    (action) => {
      const store = new LayoutStore(fixture());
      store.dedicateGroup('left');
      if (action === 'move') store.move('a', 'right');
      else if (action === 'closeGroup') store.closeGroup('left');
      else {
        if (action === 'closePopout') store.popout('a');
        store.close('a');
      }
      expect(group(store)?.dedicatedPaneId).toBeUndefined();
      expect(parseLayout(store.export())).toEqual(store.export());
    },
  );
  it('restores into a new region when every existing region is dedicated', () => {
    const store = new LayoutStore(fixture());
    store.dedicateGroup('left');
    store.dedicateGroup('right');
    store.restoreClosedTab();
    expect(groups(store.getSnapshot().root)).toHaveLength(3);
    expect(group(store).panes).toEqual(['a']);
  });
});

it('returns safely when the reserved source was explicitly removed', () => {
  const store = new LayoutStore(fixture());
  store.dedicateGroup('left');
  store.dedicateGroup('right');
  store.popout('a');
  store.removeEmptyGroup('left');
  store.returnPane('a');
  expect(groups(store.getSnapshot().root).find((g) => g.panes.includes('a'))?.id).not.toBe('right');
  expect(group(store, 'right').panes).toEqual(['c']);
  expect(parseLayout(store.export())).toEqual(store.export());
});

for (const mode of ['sibling', 'range', 'rectangle'] as const) {
  it(`merges pinned regions through ${mode} without losing views`, () => {
    const store = new LayoutStore(fixture());
    store.dedicateGroup('left');
    store.dedicateGroup('right');
    const rectangles = {
      root: { left: 0, top: 0, width: 200, height: 100 },
      left: { left: 0, top: 0, width: 100, height: 100 },
      right: { left: 100, top: 0, width: 100, height: 100 },
    };
    const merge = () =>
      mode === 'sibling'
        ? store.join('left', { source: 'user' })
        : store.joinRegions('left', 'right', {
            source: 'user',
            ...(mode === 'rectangle' ? { rectangles } : {}),
          });
    store.setCapabilities({ panes: { c: { join: false } } });
    const before = store.getSnapshot();
    expect(merge).toThrow();
    expect(store.getSnapshot()).toBe(before);
    store.setCapabilities({});
    merge();
    expect(group(store)).toMatchObject({ id: 'left', panes: ['a', 'c'], active: 'a' });
    expect(group(store).dedicatedPaneId).toBeUndefined();
    expect(store.getSnapshot().panes.a).toEqual(before.panes.a);
    expect(store.getSnapshot().panes.c).toEqual(before.panes.c);
  });
}
it('keeps the receiver pinned when joining only an empty region', () => {
  const store = new LayoutStore(fixture());
  store.dedicateGroup('left');
  store.close('c');
  store.join('left');
  expect(group(store)).toMatchObject({ panes: ['a'], dedicatedPaneId: 'a' });
});
