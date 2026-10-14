import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
  Raycaster,
  Vector3,
} from 'three';
import type { Camera, ColorRepresentation, Intersection, OrthographicCamera } from 'three';
import type { ThreeSession, ThreeView } from './index.js';

export interface CameraHelpersOptions {
  visible?: boolean;
  ray?: 'center' | 'pointer' | false;
  maxDistance?: number;
  color?: ColorRepresentation;
  /** Marker size multiplier, independent of camera projection and clipping planes. */
  size?: number;
  /** Omit to follow all registered cameras. Explicit cameras remain visible when their panes unmount. */
  cameras?: readonly Camera[];
  /** Select which viewing cameras display helpers. A camera never displays its own helper. */
  visibleIn?: (camera: Camera) => boolean;
}

/** Small camera outlines and optional picking rays. Never changes camera layers or scene assets. */
export class CameraHelpers {
  private readonly entries = new Map<Camera, CameraVisualization>();
  private readonly hidden = new WeakSet<Camera>();
  private readonly unsubscribe: () => void;
  private disposed = false;
  private visible: boolean;
  private readonly distance: number;
  private readonly size: number;

  constructor(
    private readonly session: ThreeSession,
    private readonly options: CameraHelpersOptions = {},
  ) {
    this.distance = options.maxDistance ?? 10;
    this.size = options.size ?? 1;
    if (!Number.isFinite(this.distance) || this.distance <= 0)
      throw new Error('maxDistance must be positive and finite');
    if (!Number.isFinite(this.size) || this.size <= 0)
      throw new Error('size must be positive and finite');
    this.visible = options.visible ?? true;
    this.unsubscribe = session.subscribe({
      viewsChanged: () => this.sync(),
      beforeRender: (view) => this.prepare(view),
      dispose: () => this.dispose(),
    });
    this.sync();
    session.invalidate();
  }

  setVisible(visible: boolean): void {
    if (this.disposed) return;
    this.visible = visible;
    this.session.invalidate();
  }
  setCameraVisible(camera: Camera, visible: boolean): void {
    if (this.disposed) return;
    if (visible) this.hidden.delete(camera);
    else this.hidden.add(camera);
    this.session.invalidate();
  }
  private sync(): void {
    const cameras = new Set(
      this.options.cameras ?? this.session.getViews().map((view) => view.camera),
    );
    for (const [camera, entry] of this.entries) {
      if (!cameras.has(camera)) {
        entry.dispose();
        this.entries.delete(camera);
      }
    }
    for (const camera of cameras) {
      if (this.entries.has(camera)) continue;
      const entry = new CameraVisualization(camera, this.options.color ?? '#d5aa62', this.size);
      this.entries.set(camera, entry);
      this.session.scene.add(entry.line);
    }
  }
  private prepare(view: ThreeView): () => void {
    const enabled = this.visible && (this.options.visibleIn?.(view.camera) ?? true);
    const views = this.session.getViews();
    this.session.scene.updateMatrixWorld();
    const restore = () => {
      for (const entry of this.entries.values()) entry.line.visible = false;
    };
    try {
      for (const [camera, entry] of this.entries) {
        entry.line.visible = enabled && camera !== view.camera && !this.hidden.has(camera);
        if (!entry.line.visible) continue;
        // The first registration owns input during destination-ready popout transitions.
        const source = views.find((candidate) => candidate.camera === camera);
        entry.update(this.session, this.options.ray ?? 'center', this.distance, source);
      }
    } catch (error) {
      restore();
      throw error;
    }
    return restore;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    for (const entry of this.entries.values()) entry.dispose();
    this.entries.clear();
    this.session.invalidate();
  }
}

/** Internal graphics owner; one allocation per camera, reused across all documents. */
class CameraVisualization {
  readonly line: Line<BufferGeometry, LineBasicMaterial>;
  private readonly marker: LineSegments<BufferGeometry, LineBasicMaterial>;
  private readonly hitPoint: Points<BufferGeometry, PointsMaterial>;
  private readonly positions = new Float32BufferAttribute(6, 3);
  private readonly raycaster = new Raycaster();
  private readonly origin = new Vector3();
  private readonly direction = new Vector3();
  private readonly end = new Vector3();
  private readonly hits: Intersection[] = [];
  constructor(
    private readonly camera: Camera,
    color: ColorRepresentation,
    size: number,
  ) {
    const material = new LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    this.line = new Line(new BufferGeometry().setAttribute('position', this.positions), material);
    this.line.name = `camera-helper-${camera.name || camera.uuid}`;
    this.line.userData.cameraRay = true;
    this.line.visible = false;
    this.line.matrixAutoUpdate = false;
    const corners = [
      [-0.22, -0.15, -0.35],
      [0.22, -0.15, -0.35],
      [0.22, 0.15, -0.35],
      [-0.22, 0.15, -0.35],
    ];
    const outline: number[] = [];
    for (let i = 0; i < 4; i++)
      outline.push(0, 0, 0, ...corners[i]!, ...corners[i]!, ...corners[(i + 1) % 4]!);
    if ((camera as OrthographicCamera).isOrthographicCamera) {
      // A detached ring distinguishes orthographic cameras while retaining local +Y.
      for (let i = 0; i < 32; i++) {
        const start = (i / 32) * Math.PI * 2;
        const end = ((i + 1) / 32) * Math.PI * 2;
        outline.push(
          Math.cos(start) * 0.04,
          0.23 + Math.sin(start) * 0.04,
          -0.35,
          Math.cos(end) * 0.04,
          0.23 + Math.sin(end) * 0.04,
          -0.35,
        );
      }
    } else {
      outline.push(-0.09, 0.15, -0.35, 0, 0.27, -0.35, 0, 0.27, -0.35, 0.09, 0.15, -0.35);
    }
    this.marker = new LineSegments(
      new BufferGeometry().setAttribute(
        'position',
        new Float32BufferAttribute(
          outline.map((value) => value * size),
          3,
        ),
      ),
      material,
    );
    this.marker.name = `camera-marker-${camera.name || camera.uuid}`;
    this.marker.userData.cameraMarker = true;
    const pointMaterial = new PointsMaterial({
      color,
      size: 7,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
    });
    pointMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        'void main() { if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;',
      );
    };
    this.hitPoint = new Points(
      new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3)),
      pointMaterial,
    );
    this.hitPoint.name = `camera-hit-${camera.name || camera.uuid}`;
    this.hitPoint.userData.cameraHit = true;
    this.hitPoint.visible = false;
    this.hitPoint.renderOrder = 1;
    for (const object of [this.line, this.marker, this.hitPoint]) {
      object.layers.enableAll();
      object.raycast = () => {};
      object.frustumCulled = false;
    }
    this.line.add(this.marker, this.hitPoint);
  }
  update(
    session: ThreeSession,
    mode: 'center' | 'pointer' | false,
    distance: number,
    source?: ThreeView,
  ): void {
    this.camera.updateWorldMatrix(true, false);
    this.camera.getWorldPosition(this.origin);
    this.camera.getWorldDirection(this.direction);
    this.camera.getWorldPosition(this.marker.position);
    this.camera.getWorldQuaternion(this.marker.quaternion);
    // Cancel any scene transform: cameras and ray intersections are in world space.
    this.line.matrix.copy(session.scene.matrixWorld).invert();
    this.line.geometry.setDrawRange(0, mode === false ? 0 : 2);
    this.hitPoint.visible = false;
    if (mode !== false) {
      this.raycaster.far = distance;
      this.raycaster.layers.mask = this.camera.layers.mask;
      if (mode === 'pointer' && source?.pointer)
        this.raycaster.setFromCamera(source.pointer, this.camera);
      else this.raycaster.set(this.origin, this.direction);
      this.hits.length = 0;
      this.raycaster.intersectObjects(session.scene.children, true, this.hits);
      const hit = this.hits.find((intersection) => {
        for (
          let object: import('three').Object3D | null = intersection.object;
          object;
          object = object.parent
        ) {
          if (!object.visible) return false;
        }
        return true;
      });
      this.raycaster.ray.at(hit?.distance ?? distance, this.end);
      this.hitPoint.visible = !!hit;
      if (hit) this.hitPoint.position.copy(hit.point);
      this.positions.setXYZ(0, this.origin.x, this.origin.y, this.origin.z);
      this.positions.setXYZ(1, this.end.x, this.end.y, this.end.z);
      this.positions.needsUpdate = true;
    }
    this.line.updateMatrixWorld(true);
  }
  dispose(): void {
    this.line.removeFromParent();
    this.line.geometry.dispose();
    this.marker.geometry.dispose();
    this.hitPoint.geometry.dispose();
    this.hitPoint.material.dispose();
    this.line.material.dispose();
  }
}
