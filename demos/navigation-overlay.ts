import type { NavigationAction, NavigationControls } from 'quilt-three';

/** Shared, noninteractive keyboard hints driven by accepted controller input. */
export function mountNavigationOverlay(
  host: HTMLElement,
  controls: NavigationControls,
  input: HTMLElement,
) {
  const doc = host.ownerDocument;
  const overlay = doc.createElement('div');
  overlay.className = 'demo-navigation-overlay';
  overlay.hidden = true;
  overlay.setAttribute('aria-label', 'Camera navigation keys');
  const keyboard = doc.createElement('div');
  keyboard.className = 'demo-navigation-keys';
  const caps = new Map<NavigationAction, HTMLElement>();
  for (const [action, label, description] of [
    ['down', 'Q', 'Move down'],
    ['forward', 'W', 'Move forward (W or Up arrow)'],
    ['up', 'E', 'Move up'],
    ['left', 'A', 'Move left (A or Left arrow)'],
    ['backward', 'S', 'Move backward (S or Down arrow)'],
    ['right', 'D', 'Move right (D or Right arrow)'],
    ['boost', 'Shift', 'Move faster'],
  ] as const) {
    const cap = doc.createElement('kbd');
    cap.textContent = label;
    cap.dataset.action = action;
    cap.setAttribute('aria-label', description);
    keyboard.append(cap);
    caps.set(action, cap);
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  const mouse = doc.createElementNS(svgNS, 'svg');
  mouse.classList.add('demo-navigation-mouse');
  mouse.setAttribute('viewBox', '0 0 28 40');
  mouse.setAttribute('role', 'img');
  const left = doc.createElementNS(svgNS, 'path');
  left.setAttribute('d', 'M14 1C7 1 1 6 1 13V19H14Z');
  left.dataset.mouseButton = 'left';
  const right = doc.createElementNS(svgNS, 'path');
  right.setAttribute('d', 'M14 1C21 1 27 6 27 13V19H14Z');
  right.dataset.mouseButton = 'right';
  const outline = doc.createElementNS(svgNS, 'rect');
  for (const [name, value] of Object.entries({
    x: '1',
    y: '1',
    width: '26',
    height: '38',
    rx: '12',
  }))
    outline.setAttribute(name, value);
  const dividers = doc.createElementNS(svgNS, 'path');
  dividers.setAttribute('d', 'M14 1V19M1 19H27');
  dividers.classList.add('demo-mouse-outline');
  mouse.append(left, right, outline, dividers);
  const labels = new Map<string, SVGTextElement>();
  for (const [button, x, label] of [
    ['left', '7.5', 'L'],
    ['right', '20.5', 'R'],
  ]) {
    const text = doc.createElementNS(svgNS, 'text');
    text.setAttribute('x', x!);
    text.setAttribute('y', '14');
    text.textContent = label!;
    mouse.append(text);
    labels.set(button!, text);
  }
  let mouseButtons = 0;
  const setMouse = (buttons: number) => {
    mouseButtons = buttons;
    for (const [part, mask] of [
      [left, 1],
      [right, 2],
    ] as const) {
      const pressed = String((buttons & mask) !== 0);
      part.dataset.pressed = pressed;
      labels.get(part.dataset.mouseButton!)!.dataset.pressed = pressed;
    }
  };
  const clearMouse = () => setMouse(0);
  const hide = () => {
    overlay.hidden = true;
    clearMouse();
  };
  const show = () => {
    overlay.hidden = !controls.enabled;
  };
  const visibilityChanged = () => {
    if (doc.hidden) hide();
  };
  const pointerDown = (event: PointerEvent) => {
    show();
    if (controls.enabled && event.pointerType !== 'touch') setMouse(event.buttons);
  };
  const pointerUp = (event: PointerEvent) => {
    if (mouseButtons) setMouse(event.buttons);
  };
  const pointerMove = (event: PointerEvent) => {
    const rect = input.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      hide();
    else show();
  };
  const escapePressed = (event: KeyboardEvent) => {
    if (event.key === 'Escape') clearMouse();
  };
  input.addEventListener('pointerdown', pointerDown);
  input.addEventListener('pointerenter', show);
  input.addEventListener('pointerleave', hide);
  input.addEventListener('pointermove', pointerMove);
  input.addEventListener('pointercancel', clearMouse);
  input.addEventListener('lostpointercapture', clearMouse);
  doc.addEventListener('pointerup', pointerUp);
  doc.addEventListener('keydown', escapePressed, true);
  doc.defaultView?.addEventListener('blur', hide);
  doc.addEventListener('visibilitychange', visibilityChanged);
  clearMouse();
  const hints = doc.createElement('div');
  hints.className = 'demo-navigation-hints';
  const idle = doc.createElement('span');
  idle.textContent = 'WASD / arrows to fly';
  const indicator = doc.createElement('span');
  indicator.className = 'demo-free-navigation';
  indicator.textContent = 'Free navigation';
  const escape = doc.createElement('span');
  const escapeKey = doc.createElement('kbd');
  escapeKey.textContent = 'Esc';
  escape.append(escapeKey, ' to orbit');
  hints.append(idle, indicator, escape);
  overlay.append(keyboard, mouse, hints);
  const update = () => {
    const active = controls.activeActions;
    for (const [action, cap] of caps) cap.dataset.pressed = String(active.includes(action));
    mouse.setAttribute(
      'aria-label',
      controls.mode === 'free'
        ? 'Mouse: left drag returns to Orbit; right drag looks around'
        : 'Mouse: left drag orbits; right drag pans',
    );
    const free = controls.mode === 'free';
    indicator.hidden = escape.hidden = !free;
    idle.hidden = free;
  };
  controls.addEventListener('inputchange', update);
  controls.addEventListener('modechange', update);
  update();
  host.append(overlay);
  return {
    hide,
    dispose() {
      controls.removeEventListener('inputchange', update);
      controls.removeEventListener('modechange', update);
      input.removeEventListener('pointerdown', pointerDown);
      input.removeEventListener('pointerenter', show);
      input.removeEventListener('pointerleave', hide);
      input.removeEventListener('pointermove', pointerMove);
      input.removeEventListener('pointercancel', clearMouse);
      input.removeEventListener('lostpointercapture', clearMouse);
      doc.removeEventListener('pointerup', pointerUp);
      doc.removeEventListener('keydown', escapePressed, true);
      doc.defaultView?.removeEventListener('blur', hide);
      doc.removeEventListener('visibilitychange', visibilityChanged);
      overlay.remove();
    },
  };
}
