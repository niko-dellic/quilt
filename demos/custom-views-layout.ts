import type { Node, Pane } from 'quilt-core';

export const cameraKinds = ['perspective', 'top', 'front', 'side'] as const;
export function customViewGrid(rows: number, columns: number) {
  const panes: Record<string, Pane> = {};
  const split = (nodes: Node[], axis: 'horizontal' | 'vertical', id: string): Node => {
    if (nodes.length === 1) return nodes[0]!;
    const middle = Math.ceil(nodes.length / 2);
    return {
      kind: 'split',
      id,
      axis,
      ratio: middle / nodes.length,
      children: [
        split(nodes.slice(0, middle), axis, `${id}-first`),
        split(nodes.slice(middle), axis, `${id}-last`),
      ],
    };
  };
  const lines: Node[] = [];
  for (let row = 0; row < rows; row++) {
    const cells: Node[] = [];
    for (let column = 0; column < columns; column++) {
      const id = `custom-view-${row}-${column}`;
      const kind = cameraKinds[(row * 2 + column) % cameraKinds.length]!;
      panes[id] = {
        id,
        type: 'three',
        title: `View ${row + 1}.${column + 1}`,
        icon: `camera-${kind}`,
        size: { minWidth: 80, minHeight: 80 },
      };
      cells.push({
        kind: 'group',
        id: `group-${id}`,
        panes: [id],
        active: id,
        tabDisplay: 'compact',
      });
    }
    lines.push(split(cells, 'horizontal', `custom-row-${row}`));
  }
  return { root: split(lines, 'vertical', 'custom-rows'), panes };
}
