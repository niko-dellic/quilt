import * as THREE from 'three';
import { studyBoxes, studyPlatform } from './scene-data.js';
import { state } from './model.js';
import { surfaceColors } from './surfaces.js';
export function populate(scene: THREE.Scene, invalidate = () => {}) {
  const group = new THREE.Group();
  group.name = 'model';
  const sides = Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial());
  const outline = new THREE.LineBasicMaterial();
  for (const [x, z, width, depth, height] of studyBoxes) {
    const geometry = new THREE.BoxGeometry(width / 100, height / 100, depth / 100);
    const mesh = new THREE.Mesh(geometry, sides);
    mesh.name = 'Study block';
    mesh.position.set(
      (x + width / 2 - 10) / 100,
      (height / 2 - 70) / 100,
      (z + depth / 2 - 17.5) / 100,
    );
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), outline);
    edges.raycast = () => {};
    mesh.add(edges);
    group.add(mesh);
  }
  const [x, z, width, depth] = studyPlatform;
  const platformMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const platform = new THREE.Mesh(
    new THREE.PlaneGeometry(width / 100, depth / 100),
    platformMaterial,
  );
  platform.rotation.x = -Math.PI / 2;
  platform.position.set((x + width / 2 - 10) / 100, -0.705, (z + depth / 2 - 17.5) / 100);
  const grid = new THREE.GridHelper(12, 34, '#777777', '#333333');
  grid.material.vertexColors = false;
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  grid.material.depthWrite = false;
  grid.position.y = -0.71;
  grid.raycast = () => {};
  group.add(platform, grid);
  scene.add(group);
  let previous = '';
  const sync = () => {
    const element = document.querySelector('.layouts');
    const styles = element ? getComputedStyle(element) : undefined;
    const panel = styles?.getPropertyValue('--layouts-panel').trim() || '#161616';
    const header = styles?.getPropertyValue('--layouts-header').trim() || '#252525';
    const line = styles?.getPropertyValue('--layouts-line').trim() || '#333333';
    const { color, grid: visible } = state.get();
    const key = JSON.stringify([panel, header, line, color, visible]);
    if (key === previous) return;
    previous = key;
    const paint = surfaceColors(color, panel);
    [paint.side, paint.side, paint.top, paint.front, paint.front, paint.front].forEach(
      (color, index) => sides[index]!.color.set(color),
    );
    outline.color.set(paint.edge);
    platformMaterial.color.set(header);
    scene.background = new THREE.Color(panel);
    grid.visible = visible;
    grid.material.color.set(line);
    invalidate();
  };
  const unsubscribe = state.subscribe(sync);
  const observer = new MutationObserver(sync);
  const host = document.querySelector('#workspace');
  if (host)
    observer.observe(host, {
      attributes: true,
      subtree: true,
      childList: true,
      attributeFilter: ['style'],
    });
  sync();
  return {
    group,
    dispose() {
      unsubscribe();
      observer.disconnect();
      scene.remove(group);
      group.traverse((object) => {
        const drawable = object as THREE.Mesh;
        drawable.geometry?.dispose();
      });
      sides.forEach((material) => material.dispose());
      outline.dispose();
      platformMaterial.dispose();
      grid.material.dispose();
    },
  };
}
