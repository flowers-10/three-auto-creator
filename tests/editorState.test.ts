import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import * as THREE from 'three';
import { useEditorStore } from '../src/store/EditorStore';
import { useAssetStore } from '../src/store/useAssetStore';

const values = new Map<string, string>();
Object.assign(globalThis, { localStorage: { getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } });

test('new blank project does not copy the previous scene or mutate it', () => {
  setActivePinia(createPinia());
  const store = useEditorStore();
  store.config.camera.position.x = 99;
  const blank = store.createBlankState('新园区');
  assert.equal(blank.config.name, '新园区');
  assert.deepEqual(blank.config.series, []);
  assert.equal(blank.config.camera.position.x, 0);
  assert.equal(store.config.camera.position.x, 99);
  assert.equal(store.config.series.length, 1);
});

test('project replacement restores settings and clears selection without retaining input references', () => {
  setActivePinia(createPinia());
  const store = useEditorStore();
  store.selectObjects([1]);
  const next = store.createBlankState('园区');
  next.config.camera.position = { x: 12, y: 80, z: -50 };
  next.ambientIntensity = 1.25;
  next.config.environment = { src: 'assets/sky.hdr' };
  store.applySnapshot(next);
  next.config.camera.position.x = 999;
  assert.deepEqual(store.config.camera.position, { x: 12, y: 80, z: -50 });
  assert.equal(store.ambientIntensity, 1.25);
  assert.equal(store.selectedId, 'scene');
  assert.deepEqual(store.selectedIds, []);
  const saved = store.getSnapshot();
  assert.equal(saved.config.environment.src, 'assets/sky.hdr');
  saved.config.name = 'changed';
  assert.equal(store.config.name, '园区');
});

test('imported scene settings fill omitted property-panel fields from editor defaults', () => {
  setActivePinia(createPinia());
  const store = useEditorStore();
  const next = store.createBlankState('精简配置');
  next.config.shadow = { show: false };
  next.config.fog = { show: true, color: '#c9dce8', near: 800, far: 1500 };
  store.applySnapshot(next);
  assert.equal(store.config.shadow.color, '#000');
  assert.equal(store.config.shadow.opacity, .1);
  assert.equal(store.config.fog.alpha, 1);
});

test('gizmo transforms are recorded at full precision for export and reopen', () => {
  setActivePinia(createPinia());
  const store = useEditorStore();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  mesh.userData.seriesId = 1;
  mesh.position.set(12.345678, 4, -8);
  mesh.rotation.set(.1, .3, .7);
  mesh.scale.set(2, 3, 4);
  store.syncSelectedSceneObject(mesh);
  const saved = store.getSnapshot().config.series[0];
  assert.deepEqual(saved.position, { x: 12.345678, y: 4, z: -8 });
  assert.deepEqual(saved.scale, { x: 2, y: 3, z: 4 });
  assert.deepEqual(saved.rotation, { x: .1, y: .3, z: .7 });
  store.updateSelectedSceneObjectTransform('position', 'x', Infinity);
  assert.equal(mesh.position.x, 12.345678);
  mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
});

test('asset snapshots restore every library without sharing arrays', () => {
  setActivePinia(createPinia());
  const store = useAssetStore();
  const next = { materials: [], colors: [{ id: 'red', name: '红', type: 'color', value: '#ff0000' }],
    images: [], medias: [], audios: [] };
  store.replaceSnapshot(next);
  next.colors[0].value = '#000000';
  assert.equal(store.getSnapshot().colors[0].value, '#ff0000');
  store.replaceSnapshot({ materials: [], colors: [], images: [], medias: [], audios: [] });
  assert.equal(store.colors.length, 0);
});

const seriesWorldMatrix = (series: any[], id: string): THREE.Matrix4 => {
  const item = series.find(entry => String(entry.id) === id);
  assert.ok(item);
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(item.position?.x ?? 0, item.position?.y ?? 0, item.position?.z ?? 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(item.rotation?.x ?? 0, item.rotation?.y ?? 0, item.rotation?.z ?? 0)),
    new THREE.Vector3(item.scale?.x ?? 1, item.scale?.y ?? 1, item.scale?.z ?? 1),
  );
  return item.parentId == null ? local : seriesWorldMatrix(series, String(item.parentId)).multiply(local);
};
const assertWorldMatrix = (actual: THREE.Matrix4, expected: THREE.Matrix4) => {
  actual.elements.forEach((value, index) => assert.ok(Math.abs(value - expected.elements[index]!) < 1e-9,
    `world matrix element ${index}: ${value} should equal ${expected.elements[index]}`));
};

test('ungrouping a translated, rotated, scaled group preserves every child world transform', () => {
  setActivePinia(createPinia());
  const store = useEditorStore();
  const state = store.createBlankState('groups');
  state.config.series = [
    { id: 'group', type: 'group', position: { x: 10, y: 5, z: -3 }, rotation: { x: 0, y: .5, z: 0 }, scale: { x: 2, y: 2, z: 2 } },
    { id: 'child', type: 'cube', parentId: 'group', position: { x: 2, y: 1, z: -4 }, rotation: { x: .1, y: .2, z: .3 }, scale: { x: 1.2, y: .9, z: 1.4 } },
  ];
  store.applySnapshot(state);
  const before = seriesWorldMatrix(store.config.series, 'child');
  store.selectObjects(['group']); store.ungroupSelectedObjects();
  assert.equal((store.config.series as any[]).find(item => item.id === 'child')?.parentId, undefined);
  assertWorldMatrix(seriesWorldMatrix(store.config.series, 'child'), before);
});

test('grouping objects from different transformed parents preserves their world transforms', () => {
  setActivePinia(createPinia());
  const store = useEditorStore();
  const state = store.createBlankState('groups');
  state.config.series = [
    { id: 'left', type: 'group', position: { x: 8, y: 2, z: -5 }, rotation: { x: 0, y: .4, z: 0 }, scale: { x: 2, y: 2, z: 2 } },
    { id: 'right', type: 'group', position: { x: -6, y: -3, z: 8 }, rotation: { x: 0, y: -.7, z: 0 }, scale: { x: .5, y: .5, z: .5 } },
    { id: 'a', type: 'cube', parentId: 'left', position: { x: 2, y: 1, z: 3 } },
    { id: 'b', type: 'sphere', parentId: 'right', position: { x: -1, y: 2, z: 5 } },
  ];
  store.applySnapshot(state);
  const beforeA = seriesWorldMatrix(store.config.series, 'a'), beforeB = seriesWorldMatrix(store.config.series, 'b');
  store.selectObjects(['a', 'b']); store.groupSelectedObjects();
  assertWorldMatrix(seriesWorldMatrix(store.config.series, 'a'), beforeA);
  assertWorldMatrix(seriesWorldMatrix(store.config.series, 'b'), beforeB);
});

test('ungrouping nested selected groups skips removed ancestors while retaining descendant world transforms', () => {
  setActivePinia(createPinia());
  const store = useEditorStore();
  const state = store.createBlankState('groups');
  state.config.series = [
    { id: 'outer', type: 'group', position: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: .4, z: 0 } },
    { id: 'inner', type: 'group', parentId: 'outer', position: { x: 0, y: 2, z: 4 }, scale: { x: 2, y: 2, z: 2 } },
    { id: 'child', type: 'cube', parentId: 'inner', position: { x: 3, y: 1, z: 0 } },
  ];
  store.applySnapshot(state);
  const before = seriesWorldMatrix(store.config.series, 'child');
  store.selectObjects(['inner', 'outer']); store.ungroupSelectedObjects();
  assert.equal(store.config.series.length, 1);
  assert.equal((store.config.series as any[])[0].parentId, undefined);
  assertWorldMatrix(seriesWorldMatrix(store.config.series, 'child'), before);
});
