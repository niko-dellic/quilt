import { expect, it } from 'vitest';
import { createLayout, LayoutStore } from 'quilt-core';

it('snaps to the nearest edge within the threshold and can be disabled', () => {
  const store = new LayoutStore(createLayout());
  expect(store.getResizeSnapping()).toBe(true);
  expect(store.snapResize(104, [100, 106])).toBe(106);
  expect(store.snapResize(108, [100])).toBe(100);
  expect(store.snapResize(109, [100])).toBe(109);
  expect(store.snapResize(104, [100], 2)).toBe(104);
  store.setResizeSnapping(false);
  expect(store.snapResize(104, [100])).toBe(104);
  store.load(createLayout());
  expect(store.getResizeSnapping()).toBe(false);
  expect(new LayoutStore(createLayout(), { resizeSnapping: false }).getResizeSnapping()).toBe(
    false,
  );
  expect(() => store.setResizeSnapping('yes' as unknown as boolean)).toThrow();
  expect(() => store.snapResize(NaN, [100])).toThrow();
  expect(() => store.snapResize(100, [Infinity])).toThrow();
});
