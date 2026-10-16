import type { Layout, Node } from 'quilt-core';

/** Commit once per target, then animate the actual renderer geometry. Keeping a
 * second allocator here made previews disagree with chrome/content constraints.
 * Keep region dimensions fixed during the preview so hidden chrome observers
 * do not run every frame. Counter-scale the body and resize only its content
 * bounds: text stays at its natural size and content can still reflow.
 */
export function adaptiveMotion(
  host: HTMLElement,
  layout: Layout,
  commit: (ratios: Record<string, number>) => void,
) {
  const elements = new Map(
    [...host.querySelectorAll<HTMLElement>('[data-node-id]')].map((el) => [el.dataset.nodeId!, el]),
  );
  const root = elements.get(layout.root.id)!;
  const visuals: HTMLElement[] = [];
  const visit = (node: Node) => {
    const element = elements.get(node.id)!;
    if (node.kind === 'group') visuals.push(element);
    else {
      const divider = element.querySelector<HTMLElement>(':scope > .layouts-divider');
      if (divider) visuals.push(divider);
      node.children.forEach(visit);
    }
  };
  visit(layout.root);
  const animations = new Set<Animation>();
  let borders: HTMLElement | undefined;
  // Derive shared edges from visible leaves, including interrupted animations.
  // Each edge is painted once, outside the scaled pane elements.
  const borderGeometry = (rects: DOMRect[]) => {
    const boxes = new Map(visuals.map((element, index) => [element.dataset.nodeId, rects[index]!]));
    const lines: { x: number; y: number; width: number; height: number; horizontal: boolean }[] =
      [];
    const walk = (node: Node): { x: number; y: number; width: number; height: number } => {
      if (node.kind === 'group') return boxes.get(node.id)!;
      const a = walk(node.children[0]),
        b = walk(node.children[1]);
      const x = Math.min(a.x, b.x),
        y = Math.min(a.y, b.y);
      const width = Math.max(a.x + a.width, b.x + b.width) - x;
      const height = Math.max(a.y + a.height, b.y + b.height) - y;
      const horizontal = node.axis === 'vertical';
      lines.push(
        horizontal
          ? { x, y: a.y + a.height - 1, width, height: 1, horizontal }
          : { x: a.x + a.width - 1, y, width: 1, height, horizontal },
      );
      return { x, y, width, height };
    };
    const box = walk(layout.root);
    return { box, lines };
  };
  let generation = 0;
  let startFrame = 0;
  const win = host.ownerDocument.defaultView!;
  const decorate = (active: boolean) => {
    // Clip only the outer root: leaves cross their intermediate split boundaries.
    root.classList.toggle('adaptive-border-root', active);
    for (const element of elements.values())
      element.classList.toggle('adaptive-border-owner', active);
  };
  const clearContent = () => {
    host
      .querySelectorAll<HTMLElement>('.adaptive-motion-content, .adaptive-moving-hint')
      .forEach((el) => {
        el.classList.remove('adaptive-motion-content', 'adaptive-moving-hint');
        el.style.removeProperty('--adaptive-content-width');
        el.style.removeProperty('--adaptive-content-height');
      });
  };
  const cancel = () => {
    generation++;
    win.cancelAnimationFrame(startFrame);
    startFrame = 0;
    for (const animation of animations) animation.cancel();
    animations.clear();
    borders?.remove();
    borders = undefined;
    clearContent();
  };
  const finish = () => {
    // Keep the same border renderer at rest: switching back to fractional
    // native strokes made every edge change appearance at the end of motion.
    generation++;
    win.cancelAnimationFrame(startFrame);
    startFrame = 0;
    for (const animation of animations) animation.cancel();
    animations.clear();
    clearContent();
    root.classList.remove('adaptive-motion-running');
  };
  const dispose = () => {
    cancel();
    decorate(false);
    root.classList.remove('adaptive-motion-running');
  };
  return {
    render(ratios: Record<string, number>, animated = false, duration = 220) {
      animated = animated && duration > 0;
      const before = visuals.map((element) => element.getBoundingClientRect());
      cancel();
      decorate(false);
      commit(ratios);
      const after = visuals.map((element) => element.getBoundingClientRect());
      decorate(true);
      const timing = { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' as const };
      const add = (target: HTMLElement, frames: Keyframe[]) => {
        if (!animated) return;
        const animation = target.animate(frames, timing);
        animation.pause();
        animation.currentTime = 0;
        animations.add(animation);
      };
      const from = borderGeometry(before),
        to = borderGeometry(after);
      borders = host.ownerDocument.createElement('div');
      borders.className = 'adaptive-motion-borders';
      borders.setAttribute('aria-hidden', 'true');
      borders.style.setProperty('--adaptive-pixel', `${1 / win.devicePixelRatio}px`);
      borders.style.setProperty('--adaptive-origin-x', `${to.box.x}px`);
      borders.style.setProperty('--adaptive-origin-y', `${to.box.y}px`);
      for (const [index, b] of to.lines.entries()) {
        const a = from.lines[index]!;
        const line = host.ownerDocument.createElement('div');
        line.className = 'adaptive-motion-edge';
        line.dataset.axis = b.horizontal ? 'horizontal' : 'vertical';
        const coordinates = (rect: typeof b) => ({
          '--adaptive-edge-x': `${rect.x}px`,
          '--adaptive-edge-y': `${rect.y}px`,
          '--adaptive-edge-end': `${b.horizontal ? rect.x + rect.width : rect.y + rect.height}px`,
        });
        for (const [property, value] of Object.entries(coordinates(b)))
          line.style.setProperty(property, value);
        borders.append(line);
        // Animate coordinates, not a rasterized stroke. CSS snaps both ends to
        // physical pixels and ignores motion smaller than half a device pixel.
        add(line, [coordinates(a), coordinates(b)]);
      }
      root.append(borders);
      root.classList.toggle('adaptive-motion-running', animated);
      visuals.forEach((element, index) => {
        const a = before[index]!,
          b = after[index]!;
        if (
          !a.width ||
          !a.height ||
          !b.width ||
          !b.height ||
          [a.x - b.x, a.y - b.y, a.width - b.width, a.height - b.height].every(
            (value) => Math.abs(value) < 0.1,
          )
        )
          return;
        add(element, [
          {
            transformOrigin: '0 0',
            transform: `translate(${a.x - b.x}px, ${a.y - b.y}px) scale(${a.width / b.width}, ${a.height / b.height})`,
          },
          { transformOrigin: '0 0', transform: 'translate(0px, 0px) scale(1, 1)' },
        ]);
        const body = element.querySelector<HTMLElement>(':scope > .layouts-body');
        const empty = body?.querySelector<HTMLElement>(':scope > .layouts-empty');
        const hint = empty?.querySelector<HTMLElement>('.adaptive-empty-hint');
        // Empty views need only compositor transforms. Resizing their body was
        // generating thousands of unnecessary resize notifications per sweep.
        const visibleHint = hint && empty?.matches(':hover, :focus-visible') ? hint : null;
        visibleHint?.classList.add('adaptive-moving-hint');
        const content = empty ? visibleHint : body;
        if (content) {
          // Use exact reciprocal scale in CSS, driven by two numeric endpoints.
          // This replaces the approximate 65-keyframe counter-scale curve.
          if (!empty) {
            content.classList.add('adaptive-motion-content');
            content.style.setProperty('--adaptive-content-width', `${b.width}px`);
            content.style.setProperty('--adaptive-content-height', `${b.height}px`);
          }
          add(content, [
            { '--adaptive-scale-x': a.width / b.width, '--adaptive-scale-y': a.height / b.height },
            { '--adaptive-scale-x': 1, '--adaptive-scale-y': 1 },
          ]);
        }
      });
      // Layout work can consume a substantial part of a frame. Start all
      // effects together on the next frame, after their initial geometry is set.
      startFrame = win.requestAnimationFrame((time) => {
        startFrame = 0;
        for (const animation of animations) {
          animation.play();
          animation.startTime = time;
        }
      });
      const current = generation;
      // Finish when the browser finishes, not on a timer that can cut motion
      // short when layout/content work delays the first animation frame.
      void Promise.all([...animations].map((animation) => animation.finished)).then(
        () => {
          if (generation === current) finish();
        },
        () => {},
      );
    },
    finish,
    dispose,
    get running() {
      return animations.size > 0;
    },
    /** Read only when a real interaction interrupts motion, never per frame. */
    visibleRatios() {
      const ratios: Record<string, number> = {};
      const read = (node: Node): { x: number; y: number; width: number; height: number } => {
        if (node.kind === 'group') return elements.get(node.id)!.getBoundingClientRect();
        const a = read(node.children[0]),
          b = read(node.children[1]);
        const first = node.axis === 'horizontal' ? a.width : a.height;
        const second = node.axis === 'horizontal' ? b.width : b.height;
        if (first > 0 && second > 0) ratios[node.id] = first / (first + second);
        const x = Math.min(a.x, b.x),
          y = Math.min(a.y, b.y);
        return {
          x,
          y,
          width: Math.max(a.x + a.width, b.x + b.width) - x,
          height: Math.max(a.y + a.height, b.y + b.height) - y,
        };
      };
      read(layout.root);
      return ratios;
    },
  };
}
