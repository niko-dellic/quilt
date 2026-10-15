import { describe, expect, it } from 'vitest';
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { NavigationControls } from '../../packages/three/src/navigation-controls.js';
import type { NavigationControlsOptions } from '../../packages/three/src/navigation-controls.js';

class DocumentStub extends EventTarget {
  activeElement: { closest: () => unknown } | null = null;
  hidden = false;
  defaultView = new EventTarget();
  querySelectorAll() {
    return [];
  }
}
class ElementStub extends EventTarget {
  style = {};
  tabIndex = -1;
  attributes = new Map<string, string>();
  constructor(readonly ownerDocument: DocumentStub) {
    super();
  }
  getRootNode() {
    return this.ownerDocument;
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  hasPointerCapture() {
    return false;
  }
}
function fixture(
  options: NavigationControlsOptions = {},
  scope = {},
  camera: PerspectiveCamera | OrthographicCamera = new PerspectiveCamera(),
) {
  const doc = new DocumentStub();
  const element = new ElementStub(doc);
  const controls = new NavigationControls(
    { camera, element: element as unknown as HTMLElement, inputScope: scope, invalidate() {} },
    options,
  );
  const key = (code: string, type = 'keydown', extra = {}) =>
    doc.dispatchEvent(
      Object.assign(new Event(type, { cancelable: true }), {
        code,
        key: code === 'Escape' ? 'Escape' : code,
        repeat: false,
        ...extra,
      }),
    );
  const hover = () => element.dispatchEvent(new Event('pointerenter'));
  const tick = (seconds: number, hz = 60) => {
    for (let i = 0; i < seconds * hz; i++) controls.update(1 / hz);
  };
  return { controls, camera, doc, element, key, hover, tick };
}
describe('NavigationControls', () => {
  it('normalizes diagonals and integrates acceleration independently of frame rate', () => {
    const run = (hz: number, diagonal = false) => {
      const f = fixture();
      f.hover();
      f.key('KeyW');
      if (diagonal) f.key('KeyD');
      f.tick(1, hz);
      const distance = f.camera.position.length();
      f.controls.dispose();
      return distance;
    };
    const expected = 2 * (1 - 0.15 * (1 - Math.exp(-1 / 0.15)));
    expect(run(30)).toBeCloseTo(expected, 10);
    expect(run(120)).toBeCloseTo(expected, 10);
    expect(run(60, true)).toBeCloseTo(expected, 10);
  });
  it('replaces supplied bindings, retains omitted actions, boosts and settles to idle', () => {
    const f = fixture({ bindings: { forward: ['KeyI'], left: [] } });
    f.hover();
    f.key('KeyW');
    f.key('KeyA');
    expect(f.controls.mode).toBe('orbit');
    f.key('ShiftLeft');
    f.key('KeyI');
    f.tick(1);
    expect(f.camera.position.length()).toBeGreaterThan(6);
    f.key('KeyI', 'keyup');
    f.key('ShiftLeft', 'keyup');
    const before = f.camera.position.clone();
    f.tick(3);
    expect(f.camera.position.distanceTo(before)).toBeGreaterThan(0);
    expect(f.controls.update(1 / 60)).toBe(false);
    expect(f.controls.mode).toBe('free');
    f.controls.dispose();
  });
  it('preserves pose on mode changes and position updates, including orthographic zoom', () => {
    const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    camera.position.set(3, 4, 5);
    camera.lookAt(0, 0, 0);
    camera.zoom = 2;
    const f = fixture({ target: new Vector3() }, {}, camera);
    const q = camera.quaternion.clone(),
      p = camera.position.clone();
    f.controls.setMode('free');
    f.controls.setMode('orbit');
    expect(camera.position.distanceTo(p)).toBeLessThan(1e-12);
    expect(camera.quaternion.angleTo(q)).toBeLessThan(1e-7);
    f.controls.setPosition(new Vector3(7, 8, 9));
    expect(camera.quaternion.angleTo(q)).toBeLessThan(1e-7);
    expect(camera.zoom).toBe(2);
    expect(f.controls.target.distanceTo(new Vector3(4, 4, 4))).toBeLessThan(1e-12);
    f.controls.dispose();
  });
  it('transfers hover ownership across documents without transferring held keys', () => {
    const scope = {},
      a = fixture({}, scope),
      b = fixture({}, scope);
    a.hover();
    a.key('KeyW');
    a.tick(0.5);
    const position = a.camera.position.clone();
    b.hover();
    a.tick(0.5);
    b.key('KeyW', 'keydown', { repeat: true });
    b.tick(0.5);
    expect(a.camera.position.equals(position)).toBe(true);
    expect(b.controls.mode).toBe('orbit');
    b.key('KeyW');
    b.tick(0.5);
    expect(b.controls.mode).toBe('free');
    a.controls.dispose();
    b.controls.dispose();
  });
  it('stops on blur, editable focus, disabling and disposal; ignores shortcuts and stale repeats', () => {
    const f = fixture();
    f.hover();
    f.key('KeyW', 'keydown', { ctrlKey: true });
    expect(f.controls.mode).toBe('orbit');
    f.doc.activeElement = { closest: () => ({}) };
    f.key('KeyW');
    expect(f.controls.mode).toBe('orbit');
    f.doc.activeElement = null;
    f.key('KeyW');
    f.tick(0.5);
    f.doc.defaultView.dispatchEvent(new Event('blur'));
    const p = f.camera.position.clone();
    f.tick(1);
    expect(f.camera.position.equals(p)).toBe(true);
    f.hover();
    f.key('KeyW', 'keydown', { repeat: true });
    f.tick(1);
    expect(f.camera.position.equals(p)).toBe(true);
    f.key('KeyW');
    f.controls.enabled = false;
    f.tick(1);
    expect(f.camera.position.equals(p)).toBe(true);
    f.controls.dispose();
    f.controls.dispose();
    f.key('KeyW');
    expect(f.element.getAttribute('aria-label')).toBeNull();
  });
  it('retains camera state across remounts but clears motion and clamps speed', () => {
    const scope = {},
      f = fixture({ minSpeed: 1, maxSpeed: 5 }, scope);
    f.hover();
    f.key('KeyW');
    f.tick(0.5);
    f.controls.speed = 100;
    expect(f.controls.speed).toBe(5);
    f.controls.speed = 0.01;
    expect(f.controls.speed).toBe(1);
    const position = f.camera.position.clone();
    f.controls.dispose();
    const next = fixture({ minSpeed: 1, maxSpeed: 5 }, scope, f.camera);
    expect(next.controls.mode).toBe('free');
    expect(next.controls.speed).toBe(1);
    next.hover();
    next.tick(1);
    expect(next.camera.position.distanceTo(position)).toBeLessThan(1e-12);
    next.key('Escape');
    expect(next.controls.mode).toBe('orbit');
    next.controls.dispose();
  });
});

it('releases either Shift boost and clamps wheel speed without zooming', () => {
  const run = (shift: string) => {
    const f = fixture();
    f.hover();
    f.key(shift);
    f.key('KeyW', 'keydown', { shiftKey: true });
    f.tick(0.5);
    f.key(shift, 'keyup');
    f.tick(1);
    const distance = f.camera.position.length();
    f.controls.dispose();
    return distance;
  };
  expect(run('ShiftRight')).toBeCloseTo(run('ShiftLeft'), 10);
  const f = fixture({ minSpeed: 1, maxSpeed: 3 });
  f.hover();
  f.key('KeyW');
  const wheel = (deltaY: number) =>
    f.element.dispatchEvent(Object.assign(new Event('wheel', { cancelable: true }), { deltaY }));
  wheel(-1000);
  expect(f.controls.speed).toBe(3);
  wheel(1000);
  wheel(1000);
  expect(f.controls.speed).toBe(1);
  expect(f.camera.zoom).toBe(1);
  f.controls.dispose();
});

for (const projection of ['perspective', 'orthographic']) {
  it(`${projection}: preserve restores a world-space target after navigation and remount`, () => {
    const camera =
      projection === 'perspective'
        ? new PerspectiveCamera()
        : new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    camera.position.set(3, 4, 5);
    camera.lookAt(0, 0, 0);
    const scope = {},
      target = new Vector3();
    const f = fixture({ target, orbitTargetPolicy: 'preserve' }, scope, camera);
    f.hover();
    f.key('KeyD');
    f.tick(1);
    f.key('KeyD', 'keyup');
    expect(target.length()).toBeGreaterThan(0);
    const position = camera.position.clone(),
      zoom = camera.zoom;
    f.controls.dispose();
    const next = fixture({ orbitTargetPolicy: 'preserve' }, scope, camera);
    next.controls.setMode('orbit');
    next.tick(1);
    expect(next.controls.target.length()).toBeLessThan(1e-12);
    expect(camera.position.distanceTo(position)).toBeLessThan(1e-10);
    expect(
      camera.getWorldDirection(new Vector3()).dot(position.clone().negate().normalize()),
    ).toBeCloseTo(1, 10);
    expect(camera.zoom).toBe(zoom);
    next.controls.dispose();
  });
}
