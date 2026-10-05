import { describe, it, expect } from 'vitest';
import { LayoutStore, createLayout } from '../../packages/core/src/index.js';
import { dockLayout, parseWorkspace } from '../../packages/dom/src/workspace.js';
import { PaneRegistry } from '../../packages/dom/src/registry.js';
const layout = () => createLayout({ pane: { id: 'a', type: 'notes', title: 'Notes' } });
const preset = () => ({
  version: 1,
  layout: layout(),
  theme: { panel: 'var(--card)' },
  tabBar: { placement: 'left' },
  autoCollapse: 'protected',
});
describe('workspace JSON', () => {
  it('round-trips JSON independently from application CSS and data', () => {
    const input = preset();
    expect(parseWorkspace(JSON.parse(JSON.stringify(input)))).toEqual(input);
  });
  it.each([
    { version: 2 },
    { autoCollapse: 'invalid' },
    { theme: { panel: 2 } },
    { theme: { mystery: '#fff' } },
    { tabBar: { regions: { group: null } } },
    { tabBar: { unexpected: true } },
    { theme: new Date() },
    { theme: { panel: undefined } },
  ])('rejects malformed presets: %j', (patch) => {
    expect(() => parseWorkspace({ ...preset(), ...patch })).toThrow();
  });
  it('normalizes detached panes without modifying the source and uses compatible fallback regions', () => {
    const store = new LayoutStore(layout(), { autoCollapse: 'enabled' });
    store.split('main', 'horizontal', {
      id: 'b',
      type: 'other',
      title: 'B',
      size: { maxWidth: 20 },
    });
    store.popout('a');
    store.updatePane({ ...store.getSnapshot().panes.a!, size: { minWidth: 100 } });
    const before = store.export();
    const result = dockLayout(before);
    expect(result.popouts).toEqual([]);
    expect(result.panes.a).toEqual(before.panes.a);
    expect(result.root.kind).toBe('split');
    expect(store.export()).toEqual(before);
    store.dispose();
  });
});
describe('unified registry', () => {
  it('generates IDs once per creation, preserves explicit IDs, and unregisters both views and choices', () => {
    const view = () => ({ dispose() {} });
    const registry = new PaneRegistry<typeof view>();
    const remove = registry.register({ type: 'notes', title: 'Notes', view, confirmClose: true });
    const context = { source: undefined, groupId: 'main' };
    const first = registry.tabs.list()[0]!.create(context)!;
    const second = registry.tabs.list()[0]!.create(context)!;
    expect(first.id).not.toBe(second.id);
    expect(first.type).toBe('notes');
    remove();
    remove();
    expect(registry.list()).toEqual([]);
    expect(registry.tabs.list()).toEqual([]);
    registry.register({ type: 'notes', title: 'Notes', view, create: () => ({ id: 'explicit' }) });
    expect(registry.tabs.list()[0]!.create(context)!.id).toBe('explicit');
  });
});

describe('workspace scrollbars', () => {
  it('keeps old presets native and round-trips optional preferences by value', () => {
    expect(parseWorkspace(preset()).scrollbars).toBeUndefined();
    const input = {
      ...preset(),
      scrollbars: {
        visibility: 'auto-hide',
        placement: 'gutter',
        hideDelay: 0,
        revealOn: 'scroll',
      },
    };
    const parsed = parseWorkspace(input);
    expect(parsed).toEqual(input);
    expect(parsed.scrollbars).not.toBe(input.scrollbars);
  });
  it.each([
    null,
    [],
    false,
    { visibility: 'hidden' },
    { placement: 'auto' },
    { revealOn: 'hover' },
    { hideDelay: -1 },
    { hideDelay: Infinity },
    { hideDelay: '1000' },
  ])('rejects invalid scrollbar preferences: %j', (scrollbars) => {
    expect(() => parseWorkspace({ ...preset(), scrollbars })).toThrow();
  });
});
