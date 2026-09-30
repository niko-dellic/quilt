interface Position {
  element: Element;
  top: number;
  left: number;
}

/** Retain hidden panes' offsets until their existing DOM is visible again. */
export class PaneScrollPositions {
  private positions = new WeakMap<HTMLElement, Position[]>();

  capture(pane: HTMLElement) {
    if (!pane.isConnected || !pane.getClientRects().length) return;
    const positions: Position[] = [];
    for (const element of [pane, ...pane.querySelectorAll('*')]) {
      const top = element.scrollTop;
      const left = element.scrollLeft;
      if (top || left) positions.push({ element, top, left });
    }
    this.positions.set(pane, positions);
  }

  restore(pane: HTMLElement) {
    if (!pane.isConnected || !pane.getClientRects().length) return;
    const positions = this.positions.get(pane);
    if (!positions) return;
    for (const { element, top, left } of positions) {
      if (element !== pane && !pane.contains(element)) continue;
      element.scrollTo({ top, left, behavior: 'instant' });
    }
    this.positions.delete(pane);
  }
}
