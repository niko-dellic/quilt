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
