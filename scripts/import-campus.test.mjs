import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { unzipSync } from 'fflate';
import { boundsScene, decodePng, parseGlb } from './import-campus.mjs';

const campus = new URL('../public/projects/campus/', import.meta.url);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('quantized GLB bounds preserve normalized coordinates and nested node transforms', () => {
  const scene = boundsScene({
    scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ translation: [4, 5, 6], children: [1] }, { scale: [2, 3, 4], mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ componentType: 5122, normalized: true, min: [-32767, 0, -16383.5], max: [32767, 32767, 16383.5] }],
  });
  const box = new THREE.Box3().setFromObject(scene);
  assert.deepEqual(box.min.toArray(), [2, 5, 4]);
  assert.deepEqual(box.max.toArray(), [6, 8, 8]);
});

test('bundled campus is self contained and preserves every original resource', async () => {
  const [archive, manifestBytes, reportBytes] = await Promise.all([
    readFile(new URL('campus.threeauto', campus)), readFile(new URL('project.json', campus)), readFile(new URL('campus-report.json', campus)),
  ]);
  const entries = unzipSync(archive), manifest = JSON.parse(manifestBytes), report = JSON.parse(reportBytes);
  assert.equal(Buffer.compare(Buffer.from(entries['project.json']), manifestBytes), 0);
  assert.equal(manifest.format, 'three-auto-creator'); assert.equal(manifest.version, 1);
  assert.equal(archive.byteLength, report.archiveBytes);
  assert.equal(report.resourceCount, 13);
  assert.equal(Object.keys(entries).length, report.resourceCount + 1);
  for (const resource of report.resources) {
    assert.ok(resource.path.startsWith('assets/') && !resource.path.includes('..'));
    assert.equal(entries[resource.path]?.byteLength, resource.bytes);
    assert.equal(sha256(entries[resource.path]), resource.sha256);
    if (resource.path.endsWith('.glb')) parseGlb(Buffer.from(entries[resource.path]));
  }
  const referenced = new Set([manifest.editor.config.environment.src]);
  for (const series of manifest.editor.config.series) {
    for (const key of ['src', 'detailSrc', 'texture']) if (series[key]) referenced.add(series[key]);
    if (series.glass) referenced.add(series.glass.mask);
  }
  assert.equal(referenced.size, report.resourceCount);
  for (const name of referenced) assert.ok(entries[name], `Missing project resource ${name}`);
  const ground = manifest.editor.config.series.find((series) => series.type === 'ground');
  const image = decodePng(Buffer.from(entries[ground.texture]));
  assert.deepEqual([image.width, image.height, ground.width, ground.depth], [1545, 1018, 772, 509.5]);
});

test('campus has all landmark LODs, editable root transforms, source footprints and deterministic trees', async () => {
  const manifest = JSON.parse(await readFile(new URL('project.json', campus)));
  const report = JSON.parse(await readFile(new URL('campus-report.json', campus)));
  const series = manifest.editor.config.series;
  assert.equal(series.length, 7); assert.equal(series.filter((item) => item.type === 'model').length, 4);
  assert.ok(series.every((item) => !/text|label/i.test(item.type)));
  for (const model of series.filter((item) => item.type === 'model')) {
    assert.ok(model.src && model.detailSrc);
    assert.deepEqual(model.rotation, { x: 0, y: 0, z: 0 });
    assert.deepEqual(model.scale, { x: 1, y: 1, z: 1 });
    for (const matrix of [model.assetMatrix, model.detailAssetMatrix]) {
      assert.equal(matrix.length, 16); assert.ok(matrix.every(Number.isFinite));
      assert.ok(new THREE.Matrix4().fromArray(matrix).determinant() > 0);
    }
    const landmark = report.landmarks.find((item) => `campus-${item.id}` === model.id);
    assert.deepEqual(model.position, landmark.anchor);
    for (const variant of [landmark.light, landmark.detail]) {
      assert.ok(Math.abs((variant.min.x + variant.max.x) / 2 - model.position.x) < 1e-7);
      assert.ok(Math.abs((variant.min.z + variant.max.z) / 2 - model.position.z) < 1e-7);
      assert.ok(Math.abs(variant.min.y - .08) < 1e-7);
    }
  }
  const trees = series.filter((item) => item.type === 'instances');
  assert.deepEqual(trees.map((item) => item.instanceMatrices.length), [157, 162]);
  assert.equal(trees.reduce((sum, item) => sum + item.instanceMatrices.length, 0), 319);
  for (const tree of trees) {
    assert.equal(tree.reflection, .55);
    assert.equal(tree.instanceColors.length, tree.instanceMatrices.length);
    assert.ok(tree.instanceMatrices.every((matrix) => matrix.length === 16 && matrix.every(Number.isFinite)));
    assert.ok(tree.instanceColors.every((color) => /^#[0-9a-f]{6}$/.test(color)));
  }
});
