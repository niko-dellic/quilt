import { describe, expect, it } from 'vitest';
import { OrthographicCamera, PerspectiveCamera } from 'three';
import { intersectRects, resizeCamera } from 'quilt-three';
describe('Three viewport geometry', () => {
  it('clips without changing the full projection rectangle', () => {
    const full = { left: -20, top: 10, width: 200, height: 100 };
    expect(intersectRects(full, { left: 0, top: 0, width: 100, height: 200 })).toEqual({
      left: 0,
      top: 10,
      width: 100,
      height: 100,
    });
    expect(full.width).toBe(200);
    expect(intersectRects(full, { left: 300, top: 0, width: 100, height: 200 }).width).toBe(0);
  });
  it('preserves orthographic vertical extent, center and zoom', () => {
    const camera = new OrthographicCamera(-2, 6, 5, -3, 0.1, 100);
    camera.zoom = 3;
    resizeCamera(camera, 800, 400);
    expect([camera.left, camera.right, camera.top, camera.bottom, camera.zoom]).toEqual([
      -6, 10, 5, -3, 3,
    ]);
    resizeCamera(camera, 400, 800);
    expect([camera.left, camera.right]).toEqual([0, 4]);
  });
  it('updates perspective projection and ignores zero-sized views', () => {
    const camera = new PerspectiveCamera(50, 1);
    resizeCamera(camera, 800, 400);
    expect(camera.aspect).toBe(2);
    const projection = camera.projectionMatrix.clone();
    resizeCamera(camera, 0, 0);
    expect(camera.projectionMatrix.equals(projection)).toBe(true);
  });
});

import { vi } from 'vitest';
import { Scene, Mesh, BoxGeometry, MeshBasicMaterial, Vector2 } from 'three';
import { CameraHelpers, ThreeSession, createThreeSession } from 'quilt-three';
import type { SessionObserver, ThreeView } from 'quilt-three';

function helperFixture() {
  const scene = new Scene();
  const win = { performance: { now: () => 0 } } as Window;
  const session = new ThreeSession({ scene, window: win, requestFrame: () => {} });
  const observers: SessionObserver[] = [];
  const subscribe = session.subscribe.bind(session);
  vi.spyOn(session, 'subscribe').mockImplementation((observer) => {
    observers.push(observer);
    return subscribe(observer);
  });
  return { scene, session, observers, win };
}

describe('class-based camera helper ownership', () => {
  it('keeps the factory compatible and releases helpers with the session, never shared assets', () => {
    const { scene, session, win } = helperFixture();
    const legacy = createThreeSession({ scene, window: win, requestFrame: () => {} });
    expect(legacy).toBeInstanceOf(ThreeSession);
    legacy.dispose();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    scene.add(mesh);
    const sharedDispose = vi.spyOn(mesh.geometry, 'dispose');
    const cameras = Array.from({ length: 40 }, () => new PerspectiveCamera());
    const masks = cameras.map((camera) => camera.layers.mask);
    const helpers = new CameraHelpers(session, { cameras });
    const lines = scene.children.filter((object) => object.userData.cameraRay);
    expect(lines).toHaveLength(40);
    expect(cameras.map((camera) => camera.layers.mask)).toEqual(masks);
    const geometryDispose = vi.spyOn((lines[0] as import('three').Line).geometry, 'dispose');
    session.dispose();
    helpers.dispose();
    session.dispose();
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(sharedDispose).not.toHaveBeenCalled();
    expect(scene.children).toEqual([mesh]);
    expect(() => session.subscribe({})).toThrow('disposed');
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it('tracks registrations, visibility, pointer rays, and marker-only mode without changing cameras', () => {
    const { scene, session, observers } = helperFixture();
    const source = new PerspectiveCamera(50, 1, 0.1, 100);
    source.position.set(0, 0, 5);
    const target = new PerspectiveCamera();
    const sourceView = { camera: source, pointer: null } as unknown as ThreeView;
    const targetView = { camera: target } as unknown as ThreeView;
    let views = [sourceView, targetView];
    vi.spyOn(session, 'getViews').mockImplementation(() => views);
    const helpers = new CameraHelpers(session, { ray: 'pointer' });
    const observer = observers[0]!;
    const lines = scene.children.filter(
      (object) => object.userData.cameraRay,
    ) as import('three').Line[];
    const restore = observer.beforeRender!(targetView) as () => void;
    expect(lines.map((line) => line.visible)).toEqual([true, false]);
    const centered = Array.from(lines[0]!.geometry.getAttribute('position').array);
    restore();
    expect(lines.every((line) => !line.visible)).toBe(true);
    sourceView.pointer = new Vector2(0.5, 0.5);
    const reset = observer.beforeRender!(targetView) as () => void;
    expect(Array.from(lines[0]!.geometry.getAttribute('position').array)).not.toEqual(centered);
    reset();
    helpers.setCameraVisible(source, false);
    const hidden = observer.beforeRender!(targetView) as () => void;
    expect(lines.every((line) => !line.visible)).toBe(true);
    hidden();
    helpers.setCameraVisible(source, true);
    helpers.setVisible(false);
    const allHidden = observer.beforeRender!(targetView) as () => void;
    expect(lines.every((line) => !line.visible)).toBe(true);
    allHidden();
    views = [targetView];
    observer.viewsChanged!();
    expect(scene.children).toHaveLength(1);
    helpers.dispose();
    const markers = new CameraHelpers(session, { cameras: [source], ray: false });
    const end = observers[1]!.beforeRender!(targetView) as () => void;
    const line = scene.children[0] as import('three').Line;
    expect(line.visible).toBe(true);
    expect(line.geometry.drawRange.count).toBe(0);
    expect(line.children[0]!.visible).toBe(true);
    end();
    markers.dispose();
    session.dispose();
  });
});
