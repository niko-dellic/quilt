import { describe, it, expect, vi } from 'vitest';
import { OverlayScrollbars } from 'overlayscrollbars';
import { ScrollArea } from '../../packages/dom/src/scrollbars.js';

vi.mock('overlayscrollbars', () => ({ OverlayScrollbars: vi.fn() }));

function fixture(styles: EventTarget[] = []) {
  const win = Object.assign(new EventTarget(), {
    matchMedia: () => Object.assign(new EventTarget(), { matches: false }),
    clearTimeout: vi.fn(),
    cancelAnimationFrame: vi.fn(),
  });
  const attributes = new Map<string, string>();
  const viewport = Object.assign(new EventTarget(), {
    scrollTop: 40,
    scrollLeft: 20,
    hasAttribute: (name: string) => attributes.has(name),
    getAttribute: (name: string) => attributes.get(name),
    removeAttribute: (name: string) => attributes.delete(name),
    set tabIndex(value: number) {
      attributes.set('tabindex', String(value));
    },
  });
  const host = Object.assign(new EventTarget(), {
    ownerDocument: Object.assign(new EventTarget(), {
      defaultView: win,
      querySelectorAll: () => styles,
    }),
    dataset: {} as Record<string, string>,
    style: { removeProperty: vi.fn() },
  });
  const report = vi.fn();
  const area = new ScrollArea(
    { host: host as unknown as HTMLElement, viewport: viewport as unknown as HTMLElement },
    report,
  );
  return { area, host, viewport, win, report };
}

describe('scrollbar fallback and cleanup', () => {
  it('waits for every pending stylesheet, including failed loads, before enhancing', () => {
    const create = vi.mocked(OverlayScrollbars);
    create.mockReset();
    const failure = new Error('Initialization reached');
    create.mockImplementation(((_target: unknown, options: unknown) => {
      if (options) throw failure;
    }) as unknown as typeof OverlayScrollbars);
    const first = new EventTarget();
    const second = new EventTarget();
    const { area, report, viewport } = fixture([first, second]);
    area.update({});
    first.dispatchEvent(new Event('load'));
    first.dispatchEvent(new Event('load'));
    expect(create).not.toHaveBeenCalled();
    second.dispatchEvent(new Event('error'));
    expect(report).toHaveBeenCalledWith(failure);
    expect([viewport.scrollTop, viewport.scrollLeft]).toEqual([40, 20]);
    area.dispose();
  });
  it('respects native updates and disposal while waiting for styles', () => {
    const create = vi.mocked(OverlayScrollbars);
    create.mockReset();
    const link = new EventTarget();
    const { area } = fixture([link]);
    area.update({});
    area.update(undefined);
    link.dispatchEvent(new Event('load'));
    expect(create).not.toHaveBeenCalled();
    area.dispose();
    const pending = new EventTarget();
    const remove = vi.spyOn(pending, 'removeEventListener');
    const disposed = fixture([pending]).area;
    disposed.update({});
    disposed.dispose();
    pending.dispatchEvent(new Event('load'));
    expect(remove).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
  });
  it('leaves native mode uninitialized and cleans its listeners', () => {
    const create = vi.mocked(OverlayScrollbars);
    create.mockReset();
    const { area, host, viewport, win } = fixture();
    const documentRemove = vi.spyOn(host.ownerDocument, 'removeEventListener');
    const hostRemove = vi.spyOn(host, 'removeEventListener');
    const viewportRemove = vi.spyOn(viewport, 'removeEventListener');
    const windowRemove = vi.spyOn(win, 'removeEventListener');
    area.update(undefined);
    area.dispose();
    area.dispose();
    expect(create).not.toHaveBeenCalled();
    expect(documentRemove).toHaveBeenCalledTimes(2);
    expect(hostRemove).toHaveBeenCalledTimes(5);
    expect(viewportRemove).toHaveBeenCalledTimes(3);
    expect(windowRemove).toHaveBeenCalledTimes(3);
  });
  it('destroys a partially initialized instance and restores native state after failure', () => {
    const destroy = vi.fn();
    const failure = new Error('Initialization failed');
    const create = vi.mocked(OverlayScrollbars);
    create.mockReset();
    create.mockImplementation(((_target: unknown, options: unknown) => {
      if (options) throw failure;
      return { destroy };
    }) as unknown as typeof OverlayScrollbars);
    const { area, host, viewport, report } = fixture();
    area.update({});
    expect(report).toHaveBeenCalledWith(failure);
    expect(destroy).toHaveBeenCalledOnce();
    expect(host.dataset.quiltScrollbars).toBeUndefined();
    expect(viewport.hasAttribute('tabindex')).toBe(false);
    expect([viewport.scrollTop, viewport.scrollLeft]).toEqual([40, 20]);
    area.dispose();
    expect(destroy).toHaveBeenCalledOnce();
  });
});
