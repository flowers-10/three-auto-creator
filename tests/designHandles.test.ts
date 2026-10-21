import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { updateDesignHandleSizes } from '../src/components/canvas/designHandles';

const viewport = { width: 1280, height: 720 };
function handles() {
  const gizmo = new THREE.Group();
  gizmo.position.set(83.2, 0, -52.05);
  gizmo.scale.setScalar(2.85); // Observed three-auto limit at the campus viewing distance.
  const corner = new THREE.Object3D(); corner.position.set(82.2, 1, -53.05); corner.scale.setScalar(.34);
  const face = new THREE.Object3D(); face.position.set(84.2, .5, -51.75); face.scale.setScalar(.28);
  return { gizmo, selectOverlay: { group: new THREE.Group(), cornerDots: [corner], faceDots: [face] } };
}

// Measure the rendered size through Three's projection, independently of sizing math.
function pixelSize(object: THREE.Object3D, camera: THREE.Camera) {
  const start = object.getWorldPosition(new THREE.Vector3());
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const end = start.clone().addScaledVector(right, object.scale.x);
  start.project(camera); end.project(camera);
  return Math.hypot((end.x - start.x) * viewport.width / 2, (end.y - start.y) * viewport.height / 2);
}

function assertUsableHandles(camera: THREE.Camera) {
  const design = handles();
  updateDesignHandleSizes(design, camera, viewport.height);
  const axisSize = pixelSize(design.gizmo, camera);
  assert.ok(axisSize >= 70 && axisSize <= 110, `axis must remain usable on screen, got ${axisSize.toFixed(2)}px`);
  for (const dot of [...design.selectOverlay.cornerDots, ...design.selectOverlay.faceDots]) {
    const dotSize = pixelSize(dot, camera);
    assert.ok(dotSize >= 6 && dotSize <= 12, `scale handle must remain usable on screen, got ${dotSize.toFixed(2)}px`);
  }
}

test('perspective editing handles stay usable from small scenes to campus overview, including camera zoom', () => {
  for (const distance of [860, 20, 1800]) {
    for (const zoom of [1, 2]) {
      const camera = new THREE.PerspectiveCamera(45, viewport.width / viewport.height, .5, 4000);
      camera.position.set(83.2, distance * .8, -52.05 - distance * .6);
      camera.lookAt(83.2, 0, -52.05); camera.zoom = zoom;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      assertUsableHandles(camera);
    }
  }
});

test('orthographic editing handles follow the viewport and zoom instead of camera distance', () => {
  for (const extent of [10, 600]) {
    for (const zoom of [.5, 3]) {
      const aspect = viewport.width / viewport.height;
      const camera = new THREE.OrthographicCamera(-extent * aspect, extent * aspect, extent, -extent, .5, 4000);
      camera.position.set(0, 700, -500); camera.lookAt(0, 0, 0); camera.zoom = zoom;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      assertUsableHandles(camera);
    }
  }
});
