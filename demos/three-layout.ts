import type { LayoutSnapshot } from 'quilt-vanilla';
const group = (id: string) => ({
  kind: 'group' as const,
  id: `group-${id}`,
  panes: [id],
  active: id,
});
export const layout: LayoutSnapshot = {
  version: 1,
  maximized: null,
  popouts: [],
  panes: Object.fromEntries(
    ['perspective', 'top', 'front', 'side'].map((id) => [
      id,
      {
        id,
        type: 'three',
        title: id[0]!.toUpperCase() + id.slice(1),
        icon: `camera-${id}`,
        size: { minWidth: 100, minHeight: 100 },
      },
    ]),
  ),
  root: {
    kind: 'split',
    id: 'rows',
    axis: 'vertical',
    ratio: 0.5,
    children: [
      {
        kind: 'split',
        id: 'upper',
        axis: 'horizontal',
        ratio: 0.5,
        children: [group('perspective'), group('top')],
      },
      {
        kind: 'split',
        id: 'lower',
        axis: 'horizontal',
        ratio: 0.5,
        children: [group('front'), group('side')],
      },
    ],
  },
};
