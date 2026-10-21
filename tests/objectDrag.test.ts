import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, OrthographicCamera, PerspectiveCamera, Vector2, Vector3 } from 'three';
import { createObjectDrag, hitsVisibleHandle } from '../src/components/canvas/objectDrag';

test('perspective dragging keeps the grabbed point under the cursor without jumping', () => {
  const camera = new PerspectiveCamera(90, 1, .1, 100);
  camera.position.z = 10; camera.updateMatrixWorld(true);
  const object = new Object3D(); object.position.set(1, 0, 0);
  const drag = createObjectDrag(camera, [object], new Vector2(.2, 0), new Vector3(2, 0, 0));
  assert.ok(drag);
  drag.move(new Vector2(.2, 0));
  assert.ok(object.position.distanceTo(new Vector3(1, 0, 0)) < 1e-9);
  drag.move(new Vector2(.4, .1));
  assert.ok(object.position.distanceTo(new Vector3(3, 1, 0)) < 1e-9);
  assert.equal(camera.position.z, 10);
});

test('orthographic dragging moves selected roots once and respects rotated, scaled parents', () => {
  const camera = new OrthographicCamera(-10, 10, 10, -10, .1, 100);
  camera.position.z = 10; camera.updateMatrixWorld(true);
  const parent = new Group();
  parent.rotation.z = Math.PI / 2; parent.scale.setScalar(2);
  const child = new Object3D(); child.position.set(1, 0, 0); parent.add(child);
  const nested = new Object3D(); nested.position.y = 2; child.add(nested);
  parent.updateMatrixWorld(true);
  const drag = createObjectDrag(camera, [child, nested], new Vector2(0, .2), new Vector3(0, 2, 0));
  assert.ok(drag);
  drag.move(new Vector2(.2, .3));
  assert.ok(child.getWorldPosition(new Vector3()).distanceTo(new Vector3(2, 3, 0)) < 1e-9);
  assert.equal(nested.position.y, 2, 'a selected descendant must not receive the delta twice');
  drag.cancel();
  assert.ok(child.position.distanceTo(new Vector3(1, 0, 0)) < 1e-9);
});

test('dragging in an angled view stays on the plane through the grabbed point', () => {
  const camera = new PerspectiveCamera(60, 1, .1, 100);
  camera.position.set(8, 6, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  const object = new Object3D();
  const drag = createObjectDrag(camera, [object], new Vector2(0, 0), new Vector3());
  assert.ok(drag);
  drag.move(new Vector2(.2, -.15));
  assert.ok(object.position.length() > 0);
  assert.ok(Math.abs(object.position.dot(camera.getWorldDirection(new Vector3()))) < 1e-9);
  const screen = object.position.clone().project(camera);
  assert.ok(Math.abs(screen.x - .2) < 1e-9);
  assert.ok(Math.abs(screen.y + .15) < 1e-9);
});

test('native design handles remain pickable when marked internal, but hidden handles do not intercept dragging', () => {
  const camera = new PerspectiveCamera(60, 1, .1, 100);
  camera.position.z = 10; camera.updateMatrixWorld(true);
  const group = new Group(); group.userData.__designInternal = true;
  const handle = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  handle.userData.__designInternal = true;
  group.add(handle); group.updateMatrixWorld(true);
  assert.equal(hitsVisibleHandle(camera, [handle], new Vector2()), true);
  group.visible = false;
  assert.equal(hitsVisibleHandle(camera, [handle], new Vector2()), false);
  handle.geometry.dispose(); handle.material.dispose();
});
