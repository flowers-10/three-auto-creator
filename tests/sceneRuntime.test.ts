import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSceneRuntime, isVisibleInHierarchy } from '../src/project/sceneRuntime';
import { mount, normalizeViewerEffect } from '../src/project/viewer';

// Node's fetch has no ProgressEvent in older supported runtimes; GLTFLoader uses it
// only to report downloaded byte counts, so supply the browser event value object.
if (!globalThis.ProgressEvent) {
  Object.assign(globalThis, { ProgressEvent: class extends Event {
    lengthComputable: boolean; loaded: number; total: number;
    constructor(type: string, values: ProgressEventInit = {}) {
      super(type); this.lengthComputable = values.lengthComputable ?? false;
      this.loaded = values.loaded ?? 0; this.total = values.total ?? 0;
    }
  } });
}

function triangleAsset(translation = [0, 0, 0]) {
  const positions = Buffer.from(new Float32Array([0, 0, 0, 2, 0, 0, 0, 3, 0]).buffer);
  const gltf = {
    asset: { version: '2.0' },
    buffers: [{ uri: `data:application/octet-stream;base64,${positions.toString('base64')}`, byteLength: positions.length }],
    bufferViews: [{ buffer: 0, byteLength: positions.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [2, 3, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0, translation }], scenes: [{ nodes: [0] }], scene: 0,
  };
  return `data:model/gltf+json;base64,${Buffer.from(JSON.stringify(gltf)).toString('base64')}`;
}

function fixture(series: any[], resolveAsset = () => triangleAsset(), config: Record<string, any> = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(); camera.position.z = 400;
  // These cases never render or create a GPU context. Only the runtime's renderer
  // settings and texture anisotropy limit are needed by the real Three scene/loaders.
  const renderer = { shadowMap: {}, capabilities: { getMaxAnisotropy: () => 1 } } as unknown as THREE.WebGLRenderer;
  const errors: Error[] = [];
  const runtime = createSceneRuntime({ scene, camera, renderer, config: { ...config, series }, resolveAsset, onError: error => errors.push(error) });
  const root = (id: string) => {
    const object = scene.children.find(child => child.userData.seriesId === id);
    assert.ok(object, `editable root ${id} exists synchronously`);
    return object;
  };
  return { scene, camera, runtime, root, errors };
}

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt++) await new Promise(resolve => setTimeout(resolve, 1));
  assert.ok(predicate(), 'asynchronous glTF work completed');
}

const shear = [1, 0, 0, 0, .35, 1, 0, 0, 0, 0, 1, 0, 11, 0, 0, 1];
const building = {
  id: 'building', type: 'model', src: 'triangle.gltf', detailSrc: 'triangle.gltf',
  assetMatrix: shear, detailAssetMatrix: shear, position: { x: 1, y: 2, z: 3 },
};

test('model transform edits retain the editable root, loaded geometry, and exact imported shear', async () => {
  const { runtime, root, errors } = fixture([building]);
  const object = root('building');
  try {
    await runtime.ready;
    assert.deepEqual(errors, []);
    assert.equal(object.matrixAutoUpdate, true);
    assert.deepEqual(object.position.toArray(), [1, 2, 3]);
    const asset = object.children[0]!;
    assert.equal(asset.matrixAutoUpdate, false);
    assert.deepEqual(asset.matrix.toArray(), shear);
    const mesh = asset.children[0]!.children[0] as THREE.Mesh;
    const geometry = mesh.geometry;
    object.position.x = 15; // The same direct Object3D edit made by Creator's handles.
    runtime.sync([{ ...building, position: { x: 15, y: 2, z: 3 }, rotation: { x: 0, y: .5, z: 0 }, scale: { x: 2, y: 1, z: 1 } }]);
    assert.equal(root('building'), object);
    assert.equal((asset.children[0]!.children[0] as THREE.Mesh).geometry, geometry);
    assert.equal(object.position.x, 15);
    assert.equal(object.rotation.y, .5);
    assert.deepEqual(object.scale.toArray(), [2, 1, 1]);
    assert.deepEqual(asset.matrix.toArray(), shear);
  } finally { runtime.dispose(); }
});

test('coarse and detail models share an editable root and switch with distance hysteresis', async () => {
  const { runtime, root, camera, errors } = fixture([building]);
  try {
    await runtime.ready;
    const object = root('building');
    const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    camera.position.copy(center).add(new THREE.Vector3(0, 0, 200)); runtime.update();
    await until(() => object.children.length === 2);
    runtime.update();
    const [coarse, detail] = object.children;
    assert.ok(coarse && detail);
    assert.equal(coarse.visible, true); assert.equal(detail.visible, false, '225m prefetch does not force detail');
    camera.position.copy(center).add(new THREE.Vector3(0, 0, 154)); runtime.update();
    assert.equal(coarse.visible, false); assert.equal(detail.visible, true);
    camera.position.copy(center).add(new THREE.Vector3(0, 0, 170)); runtime.update();
    assert.equal(detail.visible, true, 'detail remains visible until its 185m exit threshold');
    camera.position.copy(center).add(new THREE.Vector3(0, 0, 186)); runtime.update();
    assert.equal(coarse.visible, true); assert.equal(detail.visible, false);
    camera.position.copy(center).add(new THREE.Vector3(0, 0, 170)); runtime.update();
    assert.equal(detail.visible, false, 'coarse remains visible until the 155m entry threshold');
    assert.equal(root('building'), object);
    const geometry = (coarse.children[0]!.children[0] as THREE.Mesh).geometry;
    assert.equal((detail.children[0]!.children[0] as THREE.Mesh).geometry, geometry, 'one loader cache shares the source geometry');
    let disposals = 0; geometry.addEventListener('dispose', () => disposals++);
    runtime.dispose(); assert.equal(object.parent, null); assert.equal(disposals, 1);
    assert.deepEqual(errors, []);
  } finally { runtime.dispose(); }
});

test('disposal prevents asynchronous model completion from reattaching roots', async () => {
  const { runtime, scene, errors } = fixture([building]);
  runtime.dispose(); await runtime.ready;
  assert.deepEqual(scene.children, []);
  assert.deepEqual(errors, []);
});

test('instance matrices include source-node transforms and retain per-instance colors', async () => {
  const matrix = new THREE.Matrix4().makeTranslation(9, 2, -4);
  const { runtime, root, errors } = fixture([
    { id: 'trees', type: 'instances', src: 'triangle.gltf', instanceMatrices: [matrix.toArray()], instanceColors: ['#00ff00'], position: { x: 2, y: 0, z: 0 }, reflection: .55 },
    { id: 'ground', type: 'ground', width: 24, depth: 18 },
  ], () => triangleAsset([1, 0, 0]));
  try {
    await runtime.ready;
    const object = root('trees'), batch = object.children[0] as THREE.InstancedMesh;
    assert.equal(object.position.x, 2); assert.equal(batch.count, 1);
    const actual = new THREE.Matrix4(); batch.getMatrixAt(0, actual);
    assert.deepEqual(actual.toArray(), matrix.clone().multiply(new THREE.Matrix4().makeTranslation(1, 0, 0)).toArray());
    const color = new THREE.Color(); batch.getColorAt(0, color); assert.equal(color.getHexString(), '00ff00');
    assert.equal((batch.material as THREE.MeshStandardMaterial).envMapIntensity, .55);
    const ground = root('ground').children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
    assert.equal(ground.geometry.parameters.width, 24); assert.equal(ground.geometry.parameters.height, 18);
    assert.equal(ground.material.alphaTest, .65);
    let disposals = 0; batch.addEventListener('dispose', () => disposals++);
    runtime.dispose(); assert.equal(disposals, 1);
    assert.deepEqual(errors, []);
  } finally { runtime.dispose(); }
});

test('picking visibility rejects hidden ancestors and design helpers', () => {
  const parent = new THREE.Group(), mesh = new THREE.Mesh(); parent.add(mesh);
  assert.equal(isVisibleInHierarchy(mesh), true);
  parent.visible = false; assert.equal(isVisibleInHierarchy(mesh), false);
  parent.visible = true; parent.userData.__designInternal = true;
  assert.equal(isVisibleInHierarchy(mesh), false);
});

test('asset failures are reported and do not leave the initial ready promise pending', async () => {
  const { runtime, errors } = fixture([building], () => 'data:model/gltf+json;base64,aW52YWxpZA==');
  try {
    await runtime.ready;
    assert.equal(errors.length, 1);
    assert.match(errors[0]!.message, /triangle\.gltf/);
  } finally { runtime.dispose(); }
});


test('portable lit models get fallback illumination without doubling explicit scene lighting', async () => {
  const blank = fixture([building]);
  try {
    await blank.runtime.ready;
    const lights = blank.scene.children.filter(object => (object as THREE.Light).isLight);
    assert.equal(lights.length, 1);
    assert.equal((lights[0] as THREE.HemisphereLight).isHemisphereLight, true);
    assert.ok((lights[0] as THREE.HemisphereLight).intensity > 0);
  } finally { blank.runtime.dispose(); }
  for (const config of [
    { lighting: { hemisphere: { intensity: .7 } } },
    { lighting: {} }, { environment: {} }, { light: { show: false } },
  ]) {
    const explicit = fixture([building], () => triangleAsset(), config);
    try {
      await explicit.runtime.ready;
      const lights = explicit.scene.children.filter(object => (object as THREE.Light).isLight);
      assert.equal(lights.length, config.lighting && 'hemisphere' in config.lighting ? 1 : 0);
    } finally { explicit.runtime.dispose(); }
  }
  const primitives = fixture([{ id: 'ground', type: 'ground' }]);
  try {
    await primitives.runtime.ready;
    assert.equal(primitives.scene.children.some(object => (object as THREE.Light).isLight), false);
  } finally { primitives.runtime.dispose(); }
});


test('offline effects preserve supported AUTO options and reject unsupported effects before rendering', () => {
  assert.equal(normalizeViewerEffect({ effectsEnabled: false, activeEffect: 'pixel' }), null);
  assert.deepEqual(normalizeViewerEffect({ effectsEnabled: true, activeEffect: 'bloom', effectIntensity: .65 }),
    { type: 'bloom', options: { intensity: .65 } });
  assert.deepEqual(normalizeViewerEffect({ effectsEnabled: true, activeEffect: 'moebius', effectIntensity: 1 }),
    { type: 'moebius', options: { thickness: 1.5, amplitude: 2 } });
  const moebius = normalizeViewerEffect({ effectsEnabled: true, activeEffect: 'moebius', effectIntensity: .4 });
  assert.ok(moebius && 'thickness' in moebius.options);
  assert.ok(Math.abs(moebius.options.thickness - .6) < 1e-12);
  assert.equal(moebius.options.amplitude, .8);
  for (const effect of ['pixel', 'missing-pass']) {
    const errors: Error[] = [];
    assert.throws(() => mount({ canvas: null as unknown as HTMLCanvasElement, config: {},
      editor: { effectsEnabled: true, activeEffect: effect }, onError: error => errors.push(error) }), /不支持.*后期效果/);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!.message, new RegExp(effect));
  }
});
