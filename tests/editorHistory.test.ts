import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { useEditorStore } from '../src/store/EditorStore';

Object.assign(globalThis, { localStorage: { getItem: () => null, setItem: () => {} } });
const setup = () => { setActivePinia(createPinia()); return useEditorStore(); };

test('a press-to-release drag is one undo step even across rendered frames', async () => {
  const store = setup();
  store.selectObjects([1]);
  store.beginHistoryTransaction();
  for (const x of [2, 4, 6, 8]) {
    store.config.series[0]!.position.x = x;
    await nextTick();
  }
  assert.equal(store.canUndo, false, 'moving does not enqueue intermediate positions');
  store.endHistoryTransaction();
  assert.equal(store.canUndo, true);
  store.undo();
  assert.equal(store.config.series[0]!.position.x, 0);
  assert.deepEqual(store.selectedIds, ['1']);
  assert.equal(store.canUndo, false);
  store.redo();
  assert.equal(store.config.series[0]!.position.x, 8);
  assert.equal(store.canRedo, false);
});

test('no movement and cancelled gestures add no history and preserve redo', () => {
  const store = setup();
  store.addShape('rectangle', { x: 3, y: 0, z: 0 }, { x: 2, y: 2 });
  store.undo();
  assert.equal(store.canRedo, true);
  store.beginHistoryTransaction(); store.endHistoryTransaction();
  assert.equal(store.canUndo, false);
  assert.equal(store.canRedo, true);
  store.beginHistoryTransaction();
  store.config.series[0]!.position.x = 12;
  store.cancelHistoryTransaction();
  assert.equal(store.config.series[0]!.position.x, 0);
  assert.equal(store.canUndo, false);
  assert.equal(store.canRedo, true);
});

test('undoing creation, deletion and grouping restores the complete object hierarchy', () => {
  const store = setup();
  store.addShape('star', { x: 3, y: 2, z: 0 }, { x: 4, y: 5 });
  const shapeId = store.selectedId;
  store.selectObjects([1, shapeId]);
  store.groupSelectedObjects();
  const groupId = store.selectedId;
  store.deleteSelectedObjects();
  assert.equal(store.config.series.length, 0);
  store.undo();
  assert.equal(store.config.series.length, 3);
  assert.deepEqual(store.selectedIds, [groupId]);
  store.undo();
  assert.equal(store.config.series.length, 2);
  assert.ok((store.config.series as any[]).every(item => item.parentId == null));
  store.undo();
  assert.equal(store.config.series.length, 1);
  store.redo(); store.redo(); store.redo();
  assert.equal(store.config.series.length, 0);
});

test('a fresh edit discards redo while ordinary selection and preview do not', async () => {
  const store = setup();
  store.addShape('rectangle', { x: 1, y: 0, z: 0 }, { x: 2, y: 2 });
  store.undo();
  store.selectObjects([1]); store.isPreview = true;
  store.expandedSections.light = false;
  await nextTick();
  assert.equal(store.canRedo, true);
  store.isPreview = false;
  store.config.series[0]!.name = 'Renamed';
  await nextTick();
  assert.equal(store.canRedo, false);
  store.undo();
  assert.equal(store.config.series[0]!.name, '测试圆球');
});

test('project replacement clears history and prevents undo across projects', async () => {
  const store = setup();
  store.addShape('rectangle', { x: 1, y: 0, z: 0 }, { x: 2, y: 2 });
  store.applySnapshot(store.createBlankState('Other project'));
  await nextTick();
  store.undo();
  assert.equal(store.config.name, 'Other project');
  assert.equal(store.config.series.length, 0);
  assert.equal(store.canUndo, false);
  assert.equal(store.canRedo, false);
});

test('selecting an unchanged runtime object does not create undo records', async () => {
  const store = setup();
  const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  mesh.userData.seriesId = 1;
  store.syncSelectedSceneObject(mesh);
  await nextTick();
  assert.equal(store.canUndo, false);
  store.beginHistoryTransaction();
  mesh.position.set(2.1234567, 5, -3);
  store.syncSelectedSceneObject(mesh);
  store.endHistoryTransaction();
  store.undo();
  assert.deepEqual(store.config.series[0]!.position, { x: 0, y: 0, z: 0 });
  store.redo();
  assert.deepEqual(store.config.series[0]!.position, { x: 2.1234567, y: 5, z: -3 });
  mesh.geometry.dispose(); mesh.material.dispose();
});

test('property changes and multi-axis transforms restore together without recursive history', async () => {
  const store = setup();
  store.beginHistoryTransaction();
  store.config.series[0]!.position = { x: 3, y: 4, z: 5 };
  store.config.series[0]!.color = '#ff0000';
  store.endHistoryTransaction();
  store.undo(); await nextTick();
  assert.deepEqual(store.config.series[0]!.position, { x: 0, y: 0, z: 0 });
  assert.equal(store.config.series[0]!.color, '#7c5cff');
  assert.equal(store.canUndo, false);
  store.redo(); await nextTick();
  assert.deepEqual(store.config.series[0]!.position, { x: 3, y: 4, z: 5 });
  assert.equal(store.config.series[0]!.color, '#ff0000');
  assert.equal(store.canRedo, false);
});
