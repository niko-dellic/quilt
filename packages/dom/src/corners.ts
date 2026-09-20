import { message } from './messages.js';
import { allocate, bounds, DIVIDER, findNode, joinRange } from 'quilt-core';
import type { Group, Pane } from 'quilt-core';
import type { ResolvedLayoutOptions } from './types.js';
import { el, Scope } from './lifetime.js';
type Direction = 'left' | 'right' | 'top' | 'bottom';
/** Commit once on release; cancellation never changes the layout or pane ownership. */
export function bindCorners(
  host: HTMLElement,
  id: string,
  options: ResolvedLayoutOptions,
  scope: Scope,
  split: (pane: Pane | undefined, group: Group, direction: Direction, ratio: number) => void,
  report: (error: unknown) => void,
  measureBounds: typeof bounds = bounds,
) {
  const doc = host.ownerDocument;
  let drag: Scope | undefined;
  scope.add(() => drag?.dispose());
  const initial = findNode(options.store.getSnapshot().root, id);
  if (initial?.kind !== 'group' || !initial.panes.every((p) => options.store.can(p, 'split')))
    return;
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const handle = el(doc, 'button', 'layouts-corner');
    handle.dataset.corner = corner;
    handle.title = message(
      options,
      'Drag inward to split; drag across adjacent regions to join. Escape cancels.',
    );
    handle.setAttribute(
      'aria-label',
      message(options, 'Split or join region from {corner} corner', { corner }),
    );
    handle.tabIndex = -1; // Equivalent keyboard operations live in the pane menu.
    host.append(handle);
    scope.add(() => handle.remove());
    scope.listen(handle, 'pointerdown', (event) => {
      const start = event as PointerEvent;
      if (start.button !== 0) return;
      const node = findNode(options.store.getSnapshot().root, id);
      if (node?.kind !== 'group' || !node.panes.every((p) => options.store.can(p, 'split'))) return;
      event.preventDefault();
      event.stopPropagation();
      drag?.dispose();
      const local = new Scope();
      drag = local;
      local.add(options.store.subscribe(() => local.dispose()));
      handle.setPointerCapture(start.pointerId);
      let target:
        | { kind: 'split'; direction: Direction; ratio: number }
        | { kind: 'join'; id: string; extents: Record<string, number> }
        | undefined;
      const overlay = el(doc, 'div', 'layouts-corner-overlay');
      overlay.setAttribute('aria-hidden', 'true');
      host.closest('.layouts')!.append(overlay);
      local.add(() => overlay.remove());
      const mark = (
        rect: { left: number; top: number; width: number; height: number },
        kind: string,
        label: string,
      ) => {
        const box = el(doc, 'div', 'layouts-corner-preview');
        box.dataset.cornerPreview = kind;
        Object.assign(box.style, {
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
        box.append(el(doc, 'span', 'layouts-corner-label', label));
        overlay.append(box);
      };
      const clear = () => {
        overlay.replaceChildren();
        target = undefined;
      };
      local.add(() => {
        clear();
        try {
          handle.releasePointerCapture(start.pointerId);
        } catch {}
      });
      local.listen(handle, 'pointermove', (e) => {
        const move = e as PointerEvent;
        clear();
        if (Math.hypot(move.clientX - start.clientX, move.clientY - start.clientY) < 24) return;
        const rect = host.getBoundingClientRect();
        const inside =
          move.clientX > rect.left &&
          move.clientX < rect.right &&
          move.clientY > rect.top &&
          move.clientY < rect.bottom;
        if (inside) {
          const horizontal =
            Math.abs(move.clientX - start.clientX) > Math.abs(move.clientY - start.clientY);
          const direction: Direction = horizontal
            ? corner.endsWith('l')
              ? 'left'
              : 'right'
            : corner.startsWith('t')
              ? 'top'
              : 'bottom';
          target = {
            kind: 'split',
            direction,
            ratio: Math.max(
              0.1,
              Math.min(
                0.9,
                horizontal
                  ? (move.clientX - rect.left) / rect.width
                  : (move.clientY - rect.top) / rect.height,
              ),
            ),
          };
          const before = direction === 'left' || direction === 'top';
          const layout = options.store.getSnapshot();
          const current = findNode(layout.root, id);
          if (!current) return;
          const constraints = measureBounds(current, layout);
          const min = horizontal ? constraints.minWidth : constraints.minHeight;
          const max = horizontal ? constraints.maxWidth : constraints.maxHeight;
          const total = horizontal ? rect.width : rect.height;
          const disabled =
            current.kind === 'group' &&
            (!current.panes.every((p) => options.store.can(p, 'resize')) || min === max);
          const configuredGap = parseFloat(
            doc
              .defaultView!.getComputedStyle(host.closest('.layouts')!)
              .getPropertyValue(
                disabled
                  ? '--layouts-disabled-resize-handle-width'
                  : '--layouts-resize-handle-width',
              ),
          );
          const gap =
            Number.isFinite(configuredGap) && configuredGap >= 0
              ? configuredGap
              : disabled
                ? 0
                : DIVIDER;
          const [first, second] = allocate(
            total,
            target.ratio,
            before ? 0 : min,
            before ? Infinity : max,
            before ? min : 0,
            before ? max : Infinity,
            gap,
          );
          // Store uses content extents (excluding the divider), matching this preview exactly.
          const newRect = horizontal
            ? {
                left: rect.left + (before ? 0 : first + gap),
                top: rect.top,
                width: before ? first : second,
                height: rect.height,
              }
            : {
                left: rect.left,
                top: rect.top + (before ? 0 : first + gap),
                width: rect.width,
                height: before ? first : second,
              };
          mark(newRect, 'split', message(options, 'New pane'));
        } else {
          const layout = options.store.getSnapshot();
          const elements = Array.from(
            host.closest('.layouts')!.querySelectorAll<HTMLElement>('[data-node-id]'),
          ).filter((element) => element.closest('.layouts') === host.closest('.layouts'));
          const boxes = new Map(
            elements.map((element) => [element.dataset.nodeId!, element.getBoundingClientRect()]),
          );
          const hovered = elements.find((element) => {
            const candidate = findNode(layout.root, element.dataset.nodeId!);
            const box = boxes.get(element.dataset.nodeId!)!;
            return (
              candidate?.kind === 'group' &&
              move.clientX >= box.left &&
              move.clientX <= box.right &&
              move.clientY >= box.top &&
              move.clientY <= box.bottom
            );
          });
          if (!hovered) return;
          const receiverId = hovered.dataset.nodeId!;
          const range = joinRange(layout.root, id, receiverId);
          if (
            !range ||
            !range.selected.every((g) => g.panes.every((p) => options.store.can(p, 'join')))
          )
            return;
          const receiver = findNode(layout.root, receiverId);
          if (receiver?.kind !== 'group') return;
          const selectedBoxes = range.selected.map((g) => boxes.get(g.id));
          if (selectedBoxes.some((box) => !box)) return;
          // Require full-edge alignment in the rendered layout too (constraints can leave slack).
          const horizontal = range.row.axis === 'horizontal';
          if (
            selectedBoxes.some((box) =>
              horizontal
                ? Math.abs(box!.top - rect.top) > 1 || Math.abs(box!.bottom - rect.bottom) > 1
                : Math.abs(box!.left - rect.left) > 1 || Math.abs(box!.right - rect.right) > 1,
            )
          )
            return;
          const extents = Object.fromEntries(
            [...boxes].map(([nodeId, box]) => [nodeId, horizontal ? box.width : box.height]),
          );
          target = { kind: 'join', id: receiverId, extents };
          const targetTitle =
            layout.panes[receiver.active ?? '']?.title ?? message(options, 'Empty region');
          const sources = range.selected.filter((g) => g.id !== receiverId);
          const sourceLabel = sources.every((g) => g.panes.length === 0)
            ? message(
                options,
                sources.length === 1 ? '{count} empty region' : '{count} empty regions',
                { count: sources.length },
              )
            : sources
                .map((g) => layout.panes[g.active ?? '']?.title ?? message(options, 'Empty region'))
                .join(', ');
          for (const group of range.selected) {
            const receiving = group.id === receiverId;
            mark(
              boxes.get(group.id)!,
              receiving ? 'join-target' : 'join-source',
              receiving
                ? message(options, '{target} absorbs {source}', {
                    target: targetTitle,
                    source: sourceLabel,
                  })
                : message(options, 'Joins {target}', { target: targetTitle }),
            );
          }
          const left = Math.min(...selectedBoxes.map((box) => box!.left));
          const top = Math.min(...selectedBoxes.map((box) => box!.top));
          mark(
            {
              left,
              top,
              width: Math.max(...selectedBoxes.map((box) => box!.right)) - left,
              height: Math.max(...selectedBoxes.map((box) => box!.bottom)) - top,
            },
            'join',
            '',
          );
        }
      });
      local.listen(handle, 'pointerup', () => {
        const action = target;
        local.dispose();
        if (!action) return;
        try {
          if (action.kind === 'join')
            options.store.joinRegions(action.id, id, { source: 'user', extents: action.extents });
          else {
            const layout = options.store.getSnapshot(),
              group = findNode(layout.root, id);
            if (group?.kind === 'group')
              split(
                group.active ? layout.panes[group.active] : undefined,
                group,
                action.direction,
                action.ratio,
              );
          }
        } catch (error) {
          report(error);
        }
      });
      local.listen(handle, 'pointercancel', () => local.dispose());
      local.listen(handle, 'lostpointercapture', () => local.dispose());
      local.listen(doc, 'keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Escape') local.dispose();
      });
    });
  }
}
