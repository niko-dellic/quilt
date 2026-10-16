import { EventDispatcher, MOUSE, Quaternion, Vector3 } from 'three';
import type { Camera, OrthographicCamera, PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ControlsContext, ViewControls } from './index.js';

export type NavigationMode = 'orbit' | 'free';
export type OrbitTargetPolicy = 'follow' | 'preserve';
export type NavigationAction = 'forward' | 'backward' | 'left' | 'right' | 'down' | 'up' | 'boost';
export interface NavigationControlsOptions {
  /** Mutable application-owned orbit target. Defaults to 10 units ahead of the camera. */
  target?: Vector3;
  /** Follow navigation or restore the saved orbit point. Default: follow. */
  orbitTargetPolicy?: OrbitTargetPolicy;
  /** KeyboardEvent.code arrays per action. Omitted actions keep defaults; empty arrays disable. */
  bindings?: Partial<Record<NavigationAction, readonly string[]>>;
  /** Base movement speed in world units per second. Default: 2. */
  speed?: number;
  /** Minimum base movement speed. Default: 0.05. */
  minSpeed?: number;
  /** Maximum base movement speed, before boost. Default: 100. */
  maxSpeed?: number;
  /** Speed multiplier while a boost binding is held. Default: 4. */
  boostMultiplier?: number;
  /** Free navigation acceleration time constant in seconds. Default: 0.15. */
  acceleration?: number;
  /** Free navigation braking time constant in seconds. Default: 0.15. */
  braking?: number;
  /** Free mouse-look radians per CSS pixel. Default: 0.003. */
  lookSensitivity?: number;
}
interface Pose {
  position: Vector3;
  quaternion: Quaternion;
  target: Vector3;
  zoom: number;
}
interface State {
  mode: NavigationMode;
  speed: number;
  target: Vector3;
  distance: number;
  preservedTarget: Vector3;
  initial: Pose;
}
interface Owner {
  current?: NavigationControls;
}
const owners = new WeakMap<object, Owner>();
const states = new WeakMap<object, WeakMap<Camera, State>>();
const defaults: Record<NavigationAction, readonly string[]> = {
  forward: ['KeyW', 'ArrowUp'],
  backward: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  down: ['KeyQ'],
  up: ['KeyE'],
  boost: ['ShiftLeft', 'ShiftRight'],
};

/** Optional hovered-viewport keyboard navigation, coordinated with damped OrbitControls. */
export class NavigationControls
  extends EventDispatcher<{
    change: {};
    modechange: { mode: NavigationMode };
    inputchange: { actions: readonly NavigationAction[] };
  }>
  implements ViewControls
{
  readonly camera: PerspectiveCamera | OrthographicCamera;
  readonly target: Vector3;
  private readonly orbit: OrbitControls;
  private readonly state: State;
  private readonly owner: Owner;
  private readonly keys = new Set<string>();
  private readonly velocity = new Vector3();
  private readonly reportedPosition = new Vector3();
  private readonly cleanup: (() => void)[] = [];
  private readonly bindings: Record<NavigationAction, readonly string[]>;
  private readonly minSpeed: number;
  private readonly maxSpeed: number;
  private readonly boost: number;
  private readonly acceleration: number;
  private readonly braking: number;
  private readonly sensitivity: number;
  /** Policy used on the next return to Orbit; changing it does not move the camera. */
  orbitTargetPolicy: OrbitTargetPolicy;
  private active = true;
  private disposed = false;
  private restoring = false;
  private look: { id: number; x: number; y: number } | undefined;
  private drag: { id: number; pose: Pose } | undefined;

  constructor(
    private readonly context: ControlsContext,
    options: NavigationControlsOptions = {},
  ) {
    super();
    this.camera = context.camera as PerspectiveCamera | OrthographicCamera;
    if (!('isPerspectiveCamera' in this.camera || 'isOrthographicCamera' in this.camera))
      throw new Error('NavigationControls requires a perspective or orthographic camera');
    const positive = (value: number, name: string) => {
      if (!Number.isFinite(value) || value <= 0)
        throw new Error(`${name} must be positive and finite`);
      return value;
    };
    this.minSpeed = positive(options.minSpeed ?? 0.05, 'minSpeed');
    this.maxSpeed = positive(options.maxSpeed ?? 100, 'maxSpeed');
    if (this.maxSpeed < this.minSpeed) throw new Error('maxSpeed must be at least minSpeed');
    const speed = positive(options.speed ?? 2, 'speed');
    this.boost = positive(options.boostMultiplier ?? 4, 'boostMultiplier');
    this.acceleration = positive(options.acceleration ?? 0.15, 'acceleration');
    this.braking = positive(options.braking ?? 0.15, 'braking');
    this.sensitivity = positive(options.lookSensitivity ?? 0.003, 'lookSensitivity');
    this.bindings = { ...defaults, ...options.bindings };
    this.orbitTargetPolicy = options.orbitTargetPolicy ?? 'follow';
    const { element } = context;
    const scope = context.inputScope ?? element.ownerDocument;
    this.owner = owners.get(scope) ?? {};
    owners.set(scope, this.owner);
    const saved = states.get(scope) ?? new WeakMap<Camera, State>();
    states.set(scope, saved);
    const prior = saved.get(this.camera);
    this.target =
      prior?.target ??
      options.target ??
      this.camera.getWorldDirection(new Vector3()).multiplyScalar(10).add(this.camera.position);
    this.state = prior ?? {
      mode: 'orbit',
      speed: Math.max(this.minSpeed, Math.min(this.maxSpeed, speed)),
      target: this.target,
      distance: Math.max(this.camera.position.distanceTo(this.target), 0.001),
      preservedTarget: this.target.clone(),
      initial: this.snapshot(),
    };
    saved.set(this.camera, this.state);
    this.state.speed = Math.max(this.minSpeed, Math.min(this.maxSpeed, this.state.speed));
    const pose = this.snapshot();
    this.orbit = new OrbitControls(this.camera, element);
    this.orbit.target = this.target;
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.12;
    this.orbit.mouseButtons.RIGHT = MOUSE.PAN;
    this.orbit.mouseButtons.MIDDLE = MOUSE.PAN;
    this.applyPose(pose);
    this.orbit.enabled = this.mode === 'orbit';
    this.reportedPosition.copy(this.camera.position);
    this.orbit.addEventListener('change', this.changed);
    this.cleanup.push(() => this.orbit.removeEventListener('change', this.changed));
    const previousTabIndex = element.getAttribute('tabindex');
    const previousLabel = element.getAttribute('aria-label');
    element.tabIndex = 0;
    element.setAttribute(
      'aria-label',
      'Scene viewport. Drag to orbit, right-drag to pan. Hover and use WASD or arrow keys for Free navigation. Escape returns to Orbit.',
    );
    this.cleanup.push(() => {
      if (previousTabIndex === null) element.removeAttribute('tabindex');
      else element.setAttribute('tabindex', previousTabIndex);
      if (previousLabel === null) element.removeAttribute('aria-label');
      else element.setAttribute('aria-label', previousLabel);
    });
    const listen = <E extends Event>(
      target: EventTarget,
      type: string,
      handler: (event: E) => void,
      options: boolean | AddEventListenerOptions = false,
    ) => {
      target.addEventListener(type, handler as EventListener, options);
      this.cleanup.push(() => target.removeEventListener(type, handler as EventListener, options));
    };
    listen(element, 'pointerenter', this.enter);
    listen(element, 'pointerleave', this.leave);
    listen(element, 'pointerdown', this.pointerDown, true);
    listen(element, 'pointermove', this.pointerMove, true);
    listen(element.ownerDocument, 'pointerup', this.pointerUp);
    listen(element, 'pointercancel', this.cancel);
    listen(element, 'wheel', this.wheel, { capture: true, passive: false });
    listen(element, 'contextmenu', (event: Event) => event.preventDefault());
    listen(element, 'dblclick', () => {
      if (this.enabled) this.reset();
    });
    listen(element.ownerDocument, 'keydown', this.keyDown, true);
    listen(element.ownerDocument, 'keyup', this.keyUp, true);
    listen(element.ownerDocument, 'focusin', () => {
      if (this.blocked()) this.stop();
    });
    listen(element.ownerDocument, 'visibilitychange', () => {
      if (element.ownerDocument.hidden) this.leave();
    });
    if (element.ownerDocument.defaultView)
      listen(element.ownerDocument.defaultView, 'blur', this.leave);
  }
  /** Current navigation mode; use setMode() to switch. */
  get mode(): NavigationMode {
    return this.state.mode;
  }
  /** Base world units per second, clamped to the configured speed limits. */
  get speed(): number {
    return this.state.speed;
  }
  set speed(value: number) {
    if (!Number.isFinite(value) || value <= 0) throw new Error('speed must be positive and finite');
    this.state.speed = Math.max(this.minSpeed, Math.min(this.maxSpeed, value));
  }
  get enabled(): boolean {
    return this.active && !this.disposed;
  }
  set enabled(value: boolean) {
    if (this.active && !value) {
      const pose = this.snapshot();
      this.leave();
      this.applyPose(pose);
    }
    this.active = value;
    this.orbit.enabled = this.enabled && this.mode === 'orbit';
  }
  private snapshot(): Pose {
    return {
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
      target: this.target.clone(),
      zoom: this.camera.zoom,
    };
  }
  private applyPose(pose: Pose): void {
    this.restoring = true;
    try {
      this.orbit.disconnect();
      const pointer = this.look?.id ?? this.drag?.id;
      if (pointer !== undefined && this.context.element.hasPointerCapture(pointer))
        this.context.element.releasePointerCapture(pointer);
      this.look = undefined;
      this.drag = undefined;
      this.orbit.enableDamping = false;
      this.orbit.update();
      this.camera.position.copy(pose.position);
      this.target.copy(pose.target);
      this.camera.zoom = pose.zoom;
      this.camera.updateProjectionMatrix();
      this.orbit.update();
      this.camera.position.copy(pose.position);
      this.camera.quaternion.copy(pose.quaternion);
      this.camera.updateMatrixWorld();
      this.orbit.enableDamping = true;
      this.orbit.connect(this.context.element);
    } finally {
      this.restoring = false;
    }
  }
  /** Switch modes immediately, clearing motion. Preserve turns toward the saved target on return. */
  setMode(mode: NavigationMode): void {
    if (this.disposed || mode === this.mode) return;
    this.stop();
    const pose = this.snapshot();
    if (mode === 'free') {
      this.state.distance = Math.max(this.camera.position.distanceTo(this.target), 0.001);
      this.state.preservedTarget.copy(this.target);
    } else {
      if (this.orbitTargetPolicy === 'preserve') pose.target.copy(this.state.preservedTarget);
      else {
        pose.target
          .copy(this.camera.getWorldDirection(new Vector3()))
          .multiplyScalar(this.state.distance)
          .add(this.camera.position);
      }
      if (
        this.orbitTargetPolicy !== 'follow' &&
        pose.position.distanceToSquared(pose.target) > 1e-12
      ) {
        this.camera.lookAt(pose.target);
        pose.quaternion.copy(this.camera.quaternion);
      }
    }
    this.applyPose(pose);
    this.state.mode = mode;
    this.orbit.enabled = this.enabled && mode === 'orbit';
    this.dispatchEvent({ type: 'modechange', mode });
    this.changed();
  }
  /** Translate position and orbit target together, preserving orientation and zoom. */
  setPosition(position: Vector3): void {
    if (this.disposed) return;
    this.stop();
    const pose = this.snapshot();
    pose.target.add(position.clone().sub(pose.position));
    pose.position.copy(position);
    this.applyPose(pose);
    this.changed();
  }
  /** Restore the initial pose and Orbit mode while enabled. */
  reset(): void {
    if (!this.enabled) return;
    this.stop();
    this.applyPose(this.state.initial);
    if (this.mode !== 'orbit') {
      this.state.mode = 'orbit';
      this.dispatchEvent({ type: 'modechange', mode: 'orbit' });
    }
    this.orbit.enabled = true;
    this.changed();
  }
  private changed = (): void => {
    if (this.restoring || this.disposed) return;
    this.reportedPosition.copy(this.camera.position);
    this.dispatchEvent({ type: 'change' });
    this.context.invalidate();
  };
  private stop(): void {
    const hadKeys = this.keys.size > 0;
    this.keys.clear();
    if (hadKeys) this.inputChanged();
    this.velocity.set(0, 0, 0);
    if (this.look && this.context.element.hasPointerCapture(this.look.id))
      this.context.element.releasePointerCapture(this.look.id);
    this.look = undefined;
  }
  private enter = (): void => {
    if (!this.enabled) return;
    if (this.owner.current !== this) this.owner.current?.stop();
    this.owner.current = this;
  };
  private leave = (): void => {
    this.stop();
    if (this.owner.current === this) delete this.owner.current;
  };
  private blocked(): boolean {
    const doc = this.context.element.ownerDocument;
    if (
      doc.activeElement?.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
      )
    )
      return true;
    return [...doc.querySelectorAll('[role="menu"], [role="dialog"], dialog[open]')].some(
      (element) => element.getClientRects().length > 0,
    );
  }
  /** Actions currently held by this viewport; aliases and custom bindings are resolved. */
  get activeActions(): readonly NavigationAction[] {
    return (Object.keys(this.bindings) as NavigationAction[]).filter((action) =>
      this.action(action),
    );
  }
  private inputChanged(): void {
    this.dispatchEvent({ type: 'inputchange', actions: this.activeActions });
  }
  private action(action: NavigationAction): boolean {
    return this.bindings[action].some((code) => this.keys.has(code));
  }
  private keyDown = (event: KeyboardEvent): void => {
    if (!this.enabled || this.blocked() || event.ctrlKey || event.metaKey || event.altKey) {
      this.stop();
      return;
    }
    if (event.key === 'Escape' && (this.owner.current === this || this.drag)) {
      if (this.mode === 'free') {
        this.setMode('orbit');
        this.stop();
      } else if (this.drag) {
        const pose = this.drag.pose;
        this.applyPose(pose);
        this.changed();
      } else return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (this.owner.current !== this) return;
    const movement = (Object.keys(this.bindings) as NavigationAction[]).some(
      (action) => action !== 'boost' && this.bindings[action].includes(event.code),
    );
    const boost = this.bindings.boost.includes(event.code);
    if ((!movement && !boost) || (event.repeat && !this.keys.has(event.code))) return;
    if (boost && this.mode === 'orbit') {
      const held = this.keys.has(event.code);
      this.keys.add(event.code);
      if (!held) this.inputChanged();
      return;
    }
    if (movement && this.mode === 'orbit') {
      const heldBoost = this.bindings.boost.filter((code) => this.keys.has(code));
      this.setMode('free');
      for (const code of heldBoost) this.keys.add(code);
    }
    if (this.mode !== 'free') return;
    const held = this.keys.has(event.code);
    this.keys.add(event.code);
    if (!held) this.inputChanged();
    event.preventDefault();
    event.stopPropagation();
    this.context.invalidate();
  };
  private keyUp = (event: KeyboardEvent): void => {
    if (!this.keys.delete(event.code)) return;
    this.inputChanged();
    event.preventDefault();
    event.stopPropagation();
    this.context.invalidate();
  };
  private pointerDown = (event: PointerEvent): void => {
    if (!this.enabled) return;
    this.enter();
    this.context.element.focus({ preventScroll: true });
    if (this.mode === 'free' && event.button === 0) this.setMode('orbit');
    if (this.mode === 'free') {
      if (event.button === 2) {
        this.look = { id: event.pointerId, x: event.clientX, y: event.clientY };
        this.context.element.setPointerCapture(event.pointerId);
      }
    } else if ([0, 1, 2].includes(event.button))
      this.drag = { id: event.pointerId, pose: this.snapshot() };
  };
  private pointerMove = (event: PointerEvent): void => {
    const rect = this.context.element.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      this.leave();
      return;
    }
    if (!this.enabled || this.mode !== 'free' || !this.look || this.look.id !== event.pointerId)
      return;
    const dx = event.clientX - this.look.x,
      dy = event.clientY - this.look.y;
    this.look.x = event.clientX;
    this.look.y = event.clientY;
    const up = this.camera.up.clone().normalize();
    this.camera.quaternion.premultiply(
      new Quaternion().setFromAxisAngle(up, -dx * this.sensitivity),
    );
    const direction = this.camera.getWorldDirection(new Vector3());
    const pitch = Math.asin(Math.max(-1, Math.min(1, direction.dot(up))));
    const limit = Math.PI / 2 - 0.001;
    const change = Math.max(-limit, Math.min(limit, pitch - dy * this.sensitivity)) - pitch;
    const right = new Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.camera.quaternion.premultiply(new Quaternion().setFromAxisAngle(right, change));
    this.camera.updateMatrixWorld();
    this.changed();
  };
  private pointerUp = (): void => {
    this.look = undefined;
    this.drag = undefined;
  };
  private cancel = (): void => {
    if (this.drag && this.mode === 'orbit') {
      const pose = this.drag.pose;
      this.applyPose(pose);
      this.changed();
    }
    this.leave();
  };
  private wheel = (event: WheelEvent): void => {
    if (!this.enabled || this.mode !== 'free') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.speed *= Math.exp(-Math.max(-1000, Math.min(1000, event.deltaY)) * 0.001);
    this.context.invalidate();
  };
  /** Advance in seconds through the session scheduler; true requests another frame. */
  update(delta: number): boolean {
    if (!this.enabled) return false;
    if (this.mode === 'orbit') {
      const moving = this.orbit.update();
      if (!moving && this.reportedPosition.distanceToSquared(this.camera.position) > 1e-18)
        this.changed();
      return moving;
    }
    if (this.blocked() || this.owner.current !== this) {
      this.stop();
      return false;
    }
    const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, 0.1));
    const desired = new Vector3();
    const forward = this.camera.getWorldDirection(new Vector3());
    const right = new Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    desired.addScaledVector(
      forward,
      Number(this.action('forward')) - Number(this.action('backward')),
    );
    desired.addScaledVector(right, Number(this.action('right')) - Number(this.action('left')));
    desired.addScaledVector(
      this.camera.up.clone().normalize(),
      Number(this.action('up')) - Number(this.action('down')),
    );
    if (desired.lengthSq() > 0)
      desired.normalize().multiplyScalar(this.speed * (this.action('boost') ? this.boost : 1));
    const tau = desired.lengthSq() > 0 ? this.acceleration : this.braking;
    const decay = Math.exp(-dt / tau);
    const difference = this.velocity.clone().sub(desired);
    const displacement = desired
      .clone()
      .multiplyScalar(dt)
      .addScaledVector(difference, tau * (1 - decay));
    this.velocity.copy(desired).addScaledVector(difference, decay);
    if (desired.lengthSq() === 0 && this.velocity.lengthSq() < 1e-10) this.velocity.set(0, 0, 0);
    if (displacement.lengthSq() > 0) {
      this.camera.position.add(displacement);
      this.target.add(displacement);
      this.camera.updateMatrixWorld();
      this.changed();
    }
    return desired.lengthSq() > 0 || this.velocity.lengthSq() > 0;
  }
  /** Remove listeners and underlying controls without disposing camera or scene assets. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.leave();
    this.disposed = true;
    for (const cleanup of this.cleanup.splice(0).reverse()) cleanup();
    this.orbit.dispose();
  }
}
