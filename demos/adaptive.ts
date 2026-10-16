import { anchoredRatios } from './adaptive-edges.js';
import { adaptiveMotion } from './adaptive-motion.js';
import type { WorkspaceHandle } from 'quilt-vanilla';
import type { Node } from 'quilt-core';
import {
  adaptiveRatios,
  splitRatios,
  targetAreas,
  type Falloff,
  type Region,
} from './adaptive-layout.js';

type Motion = 'animated' | 'system' | 'instant';
let settings = {
  radius: 15,
  showRadius: false,
  strength: 65,
  duration: 550,
  falloff: 'bezier' as Falloff,
  inverted: false,
  motion: 'animated' as Motion,
};
let resetVersion = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
export function resetAdaptiveSettings() {
  resetVersion++;
  settings = {
    radius: 15,
    showRadius: false,
    strength: 65,
    duration: 550,
    falloff: 'bezier',
    inverted: false,
    motion: 'animated',
  };
  notify();
}

export function mountAdaptiveSettings(host: HTMLElement, signal: AbortSignal) {
  const doc = host.ownerDocument;
  const controls = doc.createElement('div');
  controls.className = 'demo-actions adaptive-options';
  const field = (control: HTMLElement, text: string) => {
    const label = doc.createElement('label');
    label.className = 'demo-field';
    const caption = doc.createElement('span');
    caption.textContent = text;
    label.append(caption, control);
    controls.append(label);
    return { label, caption };
  };
  const falloff = doc.createElement('select');
  falloff.setAttribute('aria-label', 'Falloff');
  for (const value of ['linear', 'bezier', 'quadratic'] as const) {
    const option = doc.createElement('option');
    option.value = value;
    option.textContent = { linear: 'Linear', bezier: 'Bézier', quadratic: 'Quadratic' }[value];
    falloff.append(option);
  }
  field(falloff, 'Falloff');
  const inverted = doc.createElement('input');
  inverted.type = 'checkbox';
  const invertedLabel = doc.createElement('label');
  invertedLabel.className = 'adaptive-inverted';
  invertedLabel.title = 'Compress distant panes more instead of nearby panes';
  invertedLabel.append(inverted, doc.createTextNode('Inverted'));
  controls.append(invertedLabel);
  const strength = doc.createElement('input');
  strength.type = 'range';
  strength.min = '0';
  strength.max = '100';
  strength.step = '1';
  strength.setAttribute('aria-label', 'Strength');
  const strengthField = field(strength, 'Strength');
  strengthField.label.classList.add('demo-range');
  const radius = doc.createElement('input');
  radius.type = 'range';
  radius.min = '5';
  radius.max = '100';
  radius.step = '1';
  radius.setAttribute('aria-label', 'Falloff radius');
  const radiusField = field(radius, 'Radius');
  radiusField.label.classList.add('demo-range');
  radiusField.label.title =
    'Percentage of the grid diagonal. Influence is measured between resting pane centers.';
  radius.addEventListener(
    'input',
    () => {
      settings.radius = radius.valueAsNumber;
      notify();
    },
    { signal },
  );
  const showRadius = doc.createElement('input');
  showRadius.type = 'checkbox';
  const debugLabel = doc.createElement('label');
  debugLabel.className = 'adaptive-inverted';
  debugLabel.title =
    'Show a cursor-centered radius size guide. Falloff stays anchored to resting pane centers to avoid pointer-driven jitter.';
  debugLabel.append(showRadius, doc.createTextNode('Show radius'));
  controls.append(debugLabel);
  showRadius.addEventListener(
    'change',
    () => {
      settings.showRadius = showRadius.checked;
      notify();
    },
    { signal },
  );
  const motion = doc.createElement('select');
  motion.setAttribute('aria-label', 'Motion');
  motion.title =
    'Animated always previews transitions; System follows Reduce Motion; Instant skips transitions';
  for (const value of ['animated', 'system', 'instant'] as const) {
    const option = doc.createElement('option');
    option.value = value;
    option.textContent = { animated: 'Animated', system: 'System', instant: 'Instant' }[value];
    motion.append(option);
  }
  field(motion, 'Motion');
  motion.addEventListener(
    'change',
    () => {
      settings.motion = motion.value as Motion;
      notify();
    },
    { signal },
  );
  const duration = doc.createElement('input');
  duration.type = 'number';
  duration.min = '0';
  duration.max = '2000';
  duration.step = '1';
  duration.setAttribute('aria-label', 'Transition duration (ms)');
  field(duration, 'Duration (ms)');
  duration.addEventListener(
    'change',
    () => {
      const value = duration.valueAsNumber;
      if (Number.isFinite(value))
        settings.duration = Math.round(Math.max(0, Math.min(2000, value)));
      notify();
    },
    { signal },
  );
  // Enter commits this setting; it must not submit the surrounding grid form.
  duration.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      duration.dispatchEvent(new Event('change'));
    },
    { signal },
  );
  const sync = () => {
    radius.value = String(settings.radius);
    radius.setAttribute('aria-valuetext', `${settings.radius}% of grid diagonal`);
    radiusField.caption.textContent = `Radius: ${settings.radius}%`;
    showRadius.checked = settings.showRadius;
    duration.value = String(settings.duration);
    motion.value = settings.motion;
    falloff.value = settings.falloff;
    inverted.checked = settings.inverted;
    strength.value = String(settings.strength);
    strength.setAttribute('aria-valuetext', `${settings.strength}%`);
    strengthField.caption.textContent = `Strength: ${settings.strength}%`;
  };
  falloff.addEventListener(
    'change',
    () => {
      settings.falloff = falloff.value as Falloff;
      notify();
    },
    { signal },
  );
  inverted.addEventListener(
    'change',
    () => {
      settings.inverted = inverted.checked;
      notify();
    },
    { signal },
  );
  strength.addEventListener(
    'input',
    () => {
      settings.strength = strength.valueAsNumber;
      notify();
    },
    { signal },
  );
  listeners.add(sync);
  sync();
  host.append(controls);
  return () => {
    listeners.delete(sync);
    controls.remove();
  };
}

export function mountAdaptiveController(
  workspace: WorkspaceHandle,
  host: HTMLElement,
  isActive: () => boolean,
) {
  const doc = host.ownerDocument,
    win = doc.defaultView!;
  const abort = new AbortController(),
    signal = abort.signal;
  let baseline = workspace.getLayout().root;
  let regions: Region[] = [],
    resting: Record<string, number> = {};
  let hovered: string | null = null,
    frame = 0,
    applying = false,
    dragging = false;
  let layoutGesture = false;
  let restingDirty = false;
  let capturedResetVersion = resetVersion;
  const anchors = new Map<string, number>();
  const targetEdges = new Map<string, number>();
  const hoverMinimums = new Map<string, { width: number; height: number }>();
  let stabilizeHover = false;
  let gestureSplit: string | undefined;
  let geometryRoot = baseline;
  let geometryWidth = 1,
    geometryHeight = 1;
  let gestureRatios: Record<string, number> = {};
  let motion: ReturnType<typeof adaptiveMotion> | undefined;
  const pinnedRegions = new Set<HTMLElement>();
  const hiddenHeaders = new Map<HTMLElement, boolean>();
  const clearPinnedRegions = () => {
    for (const element of pinnedRegions) {
      element.classList.remove('adaptive-pinned');
      element.querySelector('.adaptive-empty-hint')?.remove();
    }
    pinnedRegions.clear();
    for (const [header, hidden] of hiddenHeaders) header.hidden = hidden;
    hiddenHeaders.clear();
  };
  const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let lastX = NaN,
    lastY = NaN;
  const radiusOverlay = doc.createElement('div');
  radiusOverlay.className = 'adaptive-radius-overlay';
  radiusOverlay.setAttribute('aria-hidden', 'true');
  radiusOverlay.hidden = true;
  const radiusCircle = doc.createElement('div');
  radiusCircle.className = 'adaptive-radius-circle';
  const radiusCaption = doc.createElement('span');
  radiusCircle.append(radiusCaption);
  radiusOverlay.append(radiusCircle);
  let pointerInGrid = false;
  let guideX = 0,
    guideY = 0;
  let gridOffset = { x: 0, y: 0 };
  let gridBounds = { x: 0, y: 0, width: 0, height: 0 };
  const updateRadius = () => {
    const extent = (Math.hypot(gridBounds.width, gridBounds.height) * settings.radius) / 100;
    radiusOverlay.hidden =
      !settings.showRadius ||
      !pointerInGrid ||
      !isActive() ||
      dragging ||
      !!workspace.getLayout().maximized;
    radiusCircle.style.width = `${extent * 2}px`;
    radiusCircle.style.height = `${extent * 2}px`;
    radiusCircle.style.transform = `translate(${guideX - gridBounds.x - extent}px, ${guideY - gridBounds.y - extent}px)`;
    radiusCaption.textContent = `Radius guide · ${Math.round(extent)} px`;
  };
  const blocked = () =>
    dragging || !!doc.querySelector('dialog[open], [role="menu"], [data-resizing="true"]');
  const cancel = () => {
    win.cancelAnimationFrame(frame);
    frame = 0;
  };
  const apply = (ratios: Record<string, number>) => {
    if (!Object.keys(ratios).length || workspace.isDisposed) return;
    ratios = anchoredRatios(
      workspace.getLayout(),
      geometryRoot,
      ratios,
      anchors,
      geometryWidth,
      geometryHeight,
      targetEdges,
      stabilizeHover ? 2 : 0,
      stabilizeHover ? hoverMinimums : undefined,
    );
    const current = splitRatios(workspace.getLayout().root);
    const changes = Object.fromEntries(
      Object.entries(ratios).filter(
        ([id, ratio]) => id in current && Math.abs(current[id]! - ratio) > 1e-7,
      ),
    );
    if (!Object.keys(changes).length) return;
    applying = true;
    try {
      workspace.resizeMany(changes);
    } finally {
      applying = false;
    }
  };
  const capture = () => {
    cancel();
    if (capturedResetVersion !== resetVersion) {
      anchors.clear();
      capturedResetVersion = resetVersion;
    }
    baseline = workspace.getLayout().root;
    resting = splitRatios(baseline);
    motion?.dispose();
    const ids = new Set<string>();
    const nativeHidden = new Set<string>();
    const panes = workspace.getLayout().panes;
    const visit = (node: Node) => {
      if (node.kind === 'split') node.children.forEach(visit);
      else if (!node.panes.some((id) => ['toolbar', 'footer', 'adaptive-controls'].includes(id))) {
        ids.add(node.id);
        if (
          node.dedicatedPaneId ||
          (node.panes.length === 1 && panes[node.panes[0]!]!.header === false)
        )
          nativeHidden.add(node.id);
      }
    };
    visit(baseline);
    // These headers are hidden: avoid floating-tab probes on every animated
    // resize. Native pane content constraints still apply.
    workspace.setTabBar({
      attachment: 'floating',
      fit: 'fit',
      regions: Object.fromEntries(
        [...ids].map((id) => [id, { attachment: 'anchored', mode: 'full' }]),
      ),
    });
    clearPinnedRegions();
    const elements = [...host.querySelectorAll<HTMLElement>('[data-node-id]')].filter((el) =>
      ids.has(el.dataset.nodeId!),
    );
    // Empty regions have no pane to dedicate. Hide their chrome in the demo
    // without inventing pane IDs or changing Quilt's layout model.
    for (const element of elements) {
      const header = element.querySelector<HTMLElement>(':scope > .layouts-header');
      if (header) {
        hiddenHeaders.set(header, nativeHidden.has(element.dataset.nodeId!));
        header.hidden = true;
      }
      element.classList.add('adaptive-pinned');
      pinnedRegions.add(element);
      const empty = element.querySelector('.layouts-empty');
      if (empty) {
        const hint = doc.createElement('span');
        hint.className = 'adaptive-empty-hint';
        hint.textContent = 'Click to add a tab';
        hint.setAttribute('aria-hidden', 'true');
        empty.append(hint);
      }
    }
    const rootBox = host
      .querySelector<HTMLElement>(`[data-node-id="${baseline.id}"]`)!
      .getBoundingClientRect();
    geometryWidth = rootBox.width;
    geometryHeight = rootBox.height;
    const measuredTree = (node: Node): Node => {
      if (node.kind === 'group') return node;
      const a = host
        .querySelector<HTMLElement>(`[data-node-id="${node.children[0].id}"]`)!
        .getBoundingClientRect();
      const b = host
        .querySelector<HTMLElement>(`[data-node-id="${node.children[1].id}"]`)!
        .getBoundingClientRect();
      return {
        ...node,
        gap: Math.max(0, node.axis === 'horizontal' ? b.left - a.right : b.top - a.bottom),
        children: [measuredTree(node.children[0]), measuredTree(node.children[1])],
      };
    };
    geometryRoot = measuredTree(baseline);
    targetEdges.clear();
    for (const id of anchors.keys()) if (!(id in resting)) anchors.delete(id);
    motion = adaptiveMotion(host, workspace.getLayout(), apply);
    regions = elements
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          id: el.dataset.nodeId!,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      })
      .filter((r) => r.width > 0 && r.height > 0);
    if (regions.length) {
      const x = Math.min(...regions.map((r) => r.x)),
        y = Math.min(...regions.map((r) => r.y));
      gridBounds = {
        x,
        y,
        width: Math.max(...regions.map((r) => r.x + r.width)) - x,
        height: Math.max(...regions.map((r) => r.y + r.height)) - y,
      };
      const hostBox = host.getBoundingClientRect();
      gridOffset = { x: x - hostBox.x, y: y - hostBox.y };
      Object.assign(radiusOverlay.style, {
        left: `${x}px`,
        top: `${y}px`,
        width: `${gridBounds.width}px`,
        height: `${gridBounds.height}px`,
      });
      host.append(radiusOverlay);
    }
    updateRadius();
    hoverMinimums.clear();
    for (const region of regions)
      hoverMinimums.set(region.id, {
        width: Math.min(24, region.width / 4),
        height: Math.min(24, region.height / 4),
      });
    if (!regions.some((r) => r.id === hovered)) hovered = null;
    motion.render(resting);
  };
  const animate = () => {
    cancel();
    if (!isActive() || workspace.isDisposed || workspace.getLayout().maximized || blocked()) return;
    // Coalesce pointer events; the browser interpolates between target geometries.
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      if (!motion || blocked() || workspace.isDisposed) return;
      const target =
        hovered && settings.strength > 0
          ? {
              ...resting,
              ...adaptiveRatios(
                baseline,
                regions,
                targetAreas(
                  regions,
                  hovered,
                  settings.strength,
                  settings.falloff,
                  settings.inverted,
                  settings.radius / 100,
                ),
              ),
            }
          : resting;
      const animated =
        settings.motion === 'animated' || (settings.motion === 'system' && !reducedMotion.matches);
      // Hold barely moving shared boundaries, rather than independently rounding
      // pane rectangles (which would introduce gaps). Restores remain exact.
      stabilizeHover = hovered !== null && settings.strength > 0;
      try {
        motion.render(target, animated, settings.duration);
      } finally {
        stabilizeHover = false;
      }
    });
  };
  reducedMotion.addEventListener(
    'change',
    () => {
      if (settings.motion === 'system') animate();
    },
    { signal },
  );
  const freeze = () => {
    cancel();
    if (!isActive() || !motion || workspace.isDisposed || workspace.getLayout().maximized) return;
    if (!motion.running) return;
    const visible = motion.visibleRatios();
    motion.render(visible);
  };
  const targetAt = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    const id = element?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId ?? null;
    return regions.some((r) => r.id === id) ? id : null;
  };
  host.addEventListener(
    'pointermove',
    (event) => {
      guideX = event.clientX;
      guideY = event.clientY;
      pointerInGrid =
        event.pointerType !== 'touch' &&
        event.clientX >= gridBounds.x &&
        event.clientX <= gridBounds.x + gridBounds.width &&
        event.clientY >= gridBounds.y &&
        event.clientY <= gridBounds.y + gridBounds.height;
      if (settings.showRadius) {
        // Pure overlay updates: no target recalculation or geometry reads here.
        const extent = (Math.hypot(gridBounds.width, gridBounds.height) * settings.radius) / 100;
        radiusOverlay.hidden =
          !pointerInGrid || !isActive() || dragging || !!workspace.getLayout().maximized;
        radiusCircle.style.transform = `translate(${event.clientX - gridBounds.x - extent}px, ${event.clientY - gridBounds.y - extent}px)`;
      }
      if (
        event.pointerType === 'touch' ||
        (event.clientX === lastX && event.clientY === lastY) ||
        blocked()
      )
        return;
      lastX = event.clientX;
      lastY = event.clientY;
      const element = event.target as HTMLElement;
      // Do not restore or retarget on dividers/corners: keep the edge stationary
      // while the user approaches a resize or split handle.
      if (element.closest('.layouts-divider, .layouts-corner')) return;
      const next = targetAt(event.target);
      if (next) {
        const box = element.closest<HTMLElement>('[data-node-id]')!.getBoundingClientRect();
        const insetX = Math.min(12, box.width / 4);
        const insetY = Math.min(12, box.height / 4);
        if (
          event.clientX < box.left + insetX ||
          event.clientX > box.right - insetX ||
          event.clientY < box.top + insetY ||
          event.clientY > box.bottom - insetY
        )
          return;
      }
      if (next !== hovered) {
        hovered = next;
        animate();
      }
    },
    { signal },
  );
  host.addEventListener(
    'pointerleave',
    () => {
      pointerInGrid = false;
      radiusOverlay.hidden = true;
      if (!blocked()) {
        hovered = null;
        animate();
      }
    },
    { signal },
  );
  host.addEventListener(
    'focusin',
    (event) => {
      if (!blocked()) {
        hovered = targetAt(event.target);
        animate();
      }
    },
    { signal },
  );
  host.addEventListener(
    'focusout',
    (event) => {
      if (!host.contains(event.relatedTarget as globalThis.Node | null) && !blocked()) {
        hovered = null;
        animate();
      }
    },
    { signal },
  );
  host.addEventListener(
    'pointerdown',
    (event) => {
      layoutGesture = !!(event.target as HTMLElement).closest('.layouts-divider, .layouts-corner');
      freeze();
      if (layoutGesture) {
        gestureSplit = (event.target as HTMLElement).closest('.layouts-divider')?.parentElement
          ?.dataset.nodeId;
        gestureRatios = splitRatios(workspace.getLayout().root);
        motion?.dispose();
      }
      dragging = true;
      radiusOverlay.hidden = true;
    },
    { signal, capture: true },
  );
  host.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Enter' || event.key === ' ') freeze();
    },
    { signal, capture: true },
  );
  const release = () => {
    dragging = false;
    updateRadius();
    if (layoutGesture) {
      layoutGesture = false;
      if (restingDirty) {
        restingDirty = false;
        const current = splitRatios(workspace.getLayout().root);
        if (
          gestureSplit &&
          Math.abs((current[gestureSplit] ?? 0) - (gestureRatios[gestureSplit] ?? 0)) > 1e-7
        ) {
          const edges: { id: string; axis: string; position: number }[] = [];
          const rootBox = host
            .querySelector<HTMLElement>(`[data-node-id="${baseline.id}"]`)!
            .getBoundingClientRect();
          const visit = (node: Node) => {
            if (node.kind !== 'split') return;
            const a = host
              .querySelector<HTMLElement>(`[data-node-id="${node.children[0].id}"]`)!
              .getBoundingClientRect();
            const b = host
              .querySelector<HTMLElement>(`[data-node-id="${node.children[1].id}"]`)!
              .getBoundingClientRect();
            edges.push({
              id: node.id,
              axis: node.axis,
              position:
                node.axis === 'horizontal'
                  ? ((a.right + b.left) / 2 - rootBox.left) / rootBox.width
                  : ((a.bottom + b.top) / 2 - rootBox.top) / rootBox.height,
            });
            node.children.forEach(visit);
          };
          visit(workspace.getLayout().root);
          const edited = edges.find((edge) => edge.id === gestureSplit)!;
          const extent = edited.axis === 'horizontal' ? rootBox.width : rootBox.height;
          for (const edge of edges) {
            if (
              edge.axis === edited.axis &&
              Math.abs(edge.position - edited.position) * extent < 0.5
            )
              anchors.set(edge.id, edited.position);
          }
        }
        // Only ratios changed by the gesture become permanent. The frozen hover
        // geometry on every other split remains a temporary preview.
        apply(
          Object.fromEntries(
            Object.entries(current).map(([id, ratio]) => [
              id,
              id in gestureRatios && Math.abs(ratio - gestureRatios[id]!) <= 1e-7
                ? (resting[id] ?? ratio)
                : ratio,
            ]),
          ),
        );
        capture();
        // Keep the exact released preview and its hover target. Resting geometry
        // was measured synchronously above, before the browser can paint it.
        motion?.render(current);
      } else motion?.render(splitRatios(workspace.getLayout().root));
      return;
    }
    animate();
  };
  win.addEventListener('pointerup', release, { signal });
  win.addEventListener('pointercancel', release, { signal });
  doc.addEventListener('close', () => animate(), { capture: true, signal });
  const unsubscribe = workspace.on('change', (event) => {
    if (!isActive() || applying || !event.changes.includes('layout')) return;
    // Let Quilt handle the drag directly. Rebuilding Adaptive geometry on every
    // divider event adds a full-grid measurement and class churn to each move.
    if (dragging && layoutGesture) {
      restingDirty = true;
      return;
    }
    if (
      ['activate', 'setTabDisplay', 'setTabPlacement', 'updatePane', 'releaseGroup'].includes(
        event.action,
      )
    )
      return;
    cancel();
    motion?.dispose();
    if (workspace.getLayout().maximized) {
      radiusOverlay.hidden = true;
      return;
    }
    if (event.action === 'maximize') {
      const current = splitRatios(workspace.getLayout().root);
      apply(Object.fromEntries(Object.entries(resting).filter(([id]) => id in current)));
    }
    capture();
    animate();
  });
  const observer = new win.ResizeObserver(() => {
    if (isActive() && !workspace.getLayout().maximized) {
      if (dragging && layoutGesture) {
        restingDirty = true;
        return;
      }
      motion?.dispose();
      apply(resting);
      capture();
      animate();
    }
  });
  observer.observe(host);
  const refreshGuidePosition = () => {
    if (!settings.showRadius || !isActive()) return;
    const box = host.getBoundingClientRect();
    gridBounds.x = box.x + gridOffset.x;
    gridBounds.y = box.y + gridOffset.y;
    radiusOverlay.style.left = `${gridBounds.x}px`;
    radiusOverlay.style.top = `${gridBounds.y}px`;
    updateRadius();
  };
  win.addEventListener('scroll', refreshGuidePosition, { signal, capture: true, passive: true });
  const settingsChanged = () => {
    refreshGuidePosition();
    updateRadius();
    animate();
  };
  listeners.add(settingsChanged);
  const dispose = () => {
    cancel();
    motion?.dispose();
    clearPinnedRegions();
    abort.abort();
    observer.disconnect();
    unsubscribe();
    listeners.delete(settingsChanged);
    radiusOverlay.remove();
  };
  win.addEventListener('pagehide', dispose, { once: true, signal });
  return {
    clearManualEdges() {
      anchors.clear();
    },
    enter() {
      hovered = null;
      capture();
    },
    leave() {
      pointerInGrid = false;
      radiusOverlay.remove();
      cancel();
      hovered = null;
      motion?.render(resting);
      motion?.dispose();
      motion = undefined;
      clearPinnedRegions();
      workspace.setTabBar({ attachment: 'floating', fit: 'fit' });
    },
    dispose,
  };
}
