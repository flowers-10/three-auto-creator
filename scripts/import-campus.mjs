#!/usr/bin/env node
/**
 * Build the expanded campus as a portable Creator project without changing its
 * original assets. Usage: node scripts/import-campus.mjs [source-repo] [out-dir]
 * The source may be the three-auto repository or its packages/examples folder.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { build } from 'esbuild';
import { zipSync, unzipSync, strToU8 } from 'fflate';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const creatorDirectory = path.resolve(scriptDirectory, '..');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const vector = (value) => ({ x: value.x, y: value.y, z: value.z });
const boundsRecord = (box) => ({ min: vector(box.min), max: vector(box.max), size: vector(box.getSize(new THREE.Vector3())) });

/** Decode the source's noninterlaced, 8-bit RGB/RGBA PNG using Node's zlib. */
export function decodePng(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Expected PNG');
  let width, height, channels;
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'PNG must have 8-bit channels');
      assert.ok(data[9] === 2 || data[9] === 6, 'PNG must be RGB or RGBA');
      assert.equal(data[10] + data[11] + data[12], 0, 'PNG must use standard noninterlaced encoding');
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') chunks.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  assert.ok(width && height && channels, 'PNG has no image header');
  const source = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  assert.equal(source.length, height * (stride + 1), 'PNG scanline length');
  const decoded = new Uint8Array(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = source[y * (stride + 1)];
    assert.ok(filter <= 4, 'Unsupported PNG filter');
    for (let x = 0; x < stride; x++) {
      const offset = y * stride + x;
      const a = x >= channels ? decoded[offset - channels] : 0;
      const b = y ? decoded[offset - stride] : 0;
      const c = y && x >= channels ? decoded[offset - stride - channels] : 0;
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      decoded[offset] = source[y * (stride + 1) + 1 + x] + predictor;
    }
  }
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = decoded[i * channels]; pixels[i * 4 + 1] = decoded[i * channels + 1];
    pixels[i * 4 + 2] = decoded[i * channels + 2]; pixels[i * 4 + 3] = channels === 4 ? decoded[i * channels + 3] : 255;
  }
  return { width, height, pixels };
}

export function parseGlb(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'Expected GLB');
  assert.equal(bytes.readUInt32LE(4), 2, 'Expected glTF 2.0');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB length');
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'GLB JSON chunk must come first');
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim());
  for (const resource of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    assert.ok(!resource.uri || resource.uri.startsWith('data:'), 'GLB must contain all its resources');
  }
  return json;
}

/** Match GLTFLoader's accessor bounds, including KHR_mesh_quantization. */
function accessorBounds(accessor) {
  assert.ok(accessor?.min?.length === 3 && accessor?.max?.length === 3, 'POSITION accessor requires min/max');
  const box = new THREE.Box3(new THREE.Vector3().fromArray(accessor.min), new THREE.Vector3().fromArray(accessor.max));
  if (accessor.normalized) {
    const ranges = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
    assert.ok(ranges[accessor.componentType], 'Unsupported normalized POSITION component');
    box.min.multiplyScalar(1 / ranges[accessor.componentType]);
    box.max.multiplyScalar(1 / ranges[accessor.componentType]);
  }
  return box;
}

/** A bounds-only Three hierarchy: raw vertices never need to be decompressed. */
export function boundsScene(json) {
  const scene = new THREE.Group();
  const addNode = (index) => {
    const definition = json.nodes[index];
    assert.equal(definition.skin, undefined, 'Skinned assets need evaluated bounds');
    const object = new THREE.Group(); object.name = definition.name ?? `node_${index}`;
    if (definition.matrix) new THREE.Matrix4().fromArray(definition.matrix).decompose(object.position, object.quaternion, object.scale);
    else {
      if (definition.translation) object.position.fromArray(definition.translation);
      if (definition.rotation) object.quaternion.fromArray(definition.rotation);
      if (definition.scale) object.scale.fromArray(definition.scale);
    }
    if (definition.mesh !== undefined) for (const primitive of json.meshes[definition.mesh].primitives) {
      assert.ok(!primitive.targets?.length, 'Morph assets need evaluated bounds');
      const geometry = new THREE.BufferGeometry();
      geometry.boundingBox = accessorBounds(json.accessors[primitive.attributes.POSITION]);
      object.add(new THREE.Mesh(geometry));
    }
    for (const child of definition.children ?? []) object.add(addNode(child));
    return object;
  };
  for (const index of json.scenes[json.scene ?? 0].nodes ?? []) scene.add(addNode(index));
  scene.updateMatrixWorld(true);
  return scene;
}

async function locateExamples(source) {
  for (const candidate of [source, path.join(source, 'packages/examples')]) {
    try { if ((await stat(path.join(candidate, 'src/campusExpanded.ts'))).isFile()) return candidate; } catch { /* Try next layout. */ }
  }
  throw new Error(`Expanded campus source not found in ${source}`);
}

/** Run the actual layout and deterministic planting functions from the source. */
async function sourceFunctions(examples) {
  const sourceDirectory = path.join(examples, 'src/campus-expanded');
  const treesPath = path.join(sourceDirectory, 'trees.ts');
  const threeUrl = pathToFileURL(path.join(creatorDirectory, 'node_modules/three/build/three.module.js')).href;
  const bundled = await build({
    stdin: { contents: `export * from './layout'; export * from './landmarkLayout'; export { plantingPoints, random } from './trees';`, resolveDir: sourceDirectory, loader: 'ts' },
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    plugins: [{ name: 'campus-source-functions', setup(plugin) {
      plugin.onResolve({ filter: /^three$/ }, () => ({ path: threeUrl, external: true }));
      plugin.onLoad({ filter: /trees\.ts$/ }, async ({ path: file }) => file === treesPath ? {
        contents: (await readFile(file, 'utf8')).replace('function plantingPoints(', 'export function plantingPoints(').replace('function random(', 'export function random('), loader: 'ts',
      } : undefined);
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString('base64')}`);
}

function assertBoxEqual(actual, expected, message) {
  assert.ok(actual.min.distanceTo(expected.min) < 1e-7 && actual.max.distanceTo(expected.max) < 1e-7, message);
}

/** Reproduce loadBuilding, then keep fitLandmark's shear in an asset matrix. */
export function landmarkAsset(json, building, functions) {
  assert.equal(building.node, undefined, 'Subnode-only source models require explicit renderer support');
  const root = boundsScene(json), placement = new THREE.Group();
  placement.add(root); placement.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(placement);
  root.scale.multiplyScalar(building.height / bounds.getSize(new THREE.Vector3()).y);
  placement.rotation.y = building.yaw; placement.updateMatrixWorld(true);
  bounds.setFromObject(placement);
  if (building.width !== undefined) {
    root.scale.x *= building.width / bounds.getSize(new THREE.Vector3()).x;
    placement.updateMatrixWorld(true); bounds.setFromObject(placement);
  }
  const center = bounds.getCenter(new THREE.Vector3());
  placement.position.set(building.x - center.x, 0.08 - bounds.min.y, building.z - center.z);
  const fitted = functions.fitLandmark(placement, building.id);
  const anchor = functions.landmarkCenter(building.id);
  const assetMatrix = new THREE.Matrix4().makeTranslation(-anchor.x, 0, -anchor.z)
    .multiply(fitted.matrix).multiply(placement.matrix).multiply(root.matrix);
  const expected = new THREE.Box3().setFromObject(fitted);
  const runtimeRoot = new THREE.Group();
  runtimeRoot.position.copy(anchor);
  const asset = new THREE.Group(); asset.matrix.copy(assetMatrix); asset.matrixAutoUpdate = false;
  asset.add(boundsScene(json)); runtimeRoot.add(asset); runtimeRoot.updateMatrixWorld(true);
  const actual = new THREE.Box3().setFromObject(runtimeRoot);
  assertBoxEqual(actual, expected, `Serialized landmark matrix must match source: ${building.id}`);
  assert.ok(Math.abs(expected.min.y - 0.08) < 1e-7 && Math.abs(expected.max.y - building.height - 0.08) < 1e-7, 'Building must sit at source height');
  assert.ok(Math.hypot(expected.getCenter(new THREE.Vector3()).x - anchor.x, expected.getCenter(new THREE.Vector3()).z - anchor.z) < 1e-7, 'Landmark must stay at its paving anchor');
  return { anchor, assetMatrix: assetMatrix.toArray(), bounds: boundsRecord(expected) };
}

export async function generateCampus(source, output) {
  const examples = await locateExamples(path.resolve(source));
  const functions = await sourceFunctions(examples);
  assert.equal(functions.expandedLandmarks.length, 4, 'Expected four approved campus landmarks');
  const files = new Map(), resources = [], gltfs = new Map();
  async function asset(relative) {
    const portable = `assets/${relative}`;
    if (!files.has(portable)) {
      const bytes = await readFile(path.join(examples, 'public', relative));
      files.set(portable, bytes);
      resources.push({ path: portable, source: `public/${relative}`, bytes: bytes.length, sha256: digest(bytes) });
      if (relative.endsWith('.glb')) gltfs.set(portable, parseGlb(bytes));
    }
    return portable;
  }
  const groundTexture = await asset('models/campus-expanded/ground-landscaped.png');
  const environment = await asset('hdr/kloofendal-sky-2k.hdr');
  const series = [{ id: 'campus-ground', name: '园区地面', type: 'ground', texture: groundTexture,
    width: functions.expandedGround.widthPixels * functions.expandedGround.metresPerPixel,
    depth: functions.expandedGround.heightPixels * functions.expandedGround.metresPerPixel,
    position: { x: 0, y: .06, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }];
  const landmarks = [];
  for (const building of functions.expandedLandmarks) {
    const src = await asset(`models/campus/${building.file}`);
    const detailSrc = await asset(`models/campus/${building.detailFile}`);
    const base = landmarkAsset(gltfs.get(src), building, functions);
    const detail = landmarkAsset(gltfs.get(detailSrc), building, functions);
    const model = { id: `campus-${building.id}`, name: building.name, type: 'model', src, detailSrc,
      position: vector(base.anchor), rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
      assetMatrix: base.assetMatrix, detailAssetMatrix: detail.assetMatrix, reflection: .8 };
    if (building.id === 'main') model.glass = {
      mask: await asset('models/campus/twin-terrace-glass-mask.webp'), metalness: .25, roughness: .6, reflection: 1.35,
    };
    series.push(model);
    landmarks.push({ id: building.id, name: building.name, anchor: vector(base.anchor), light: base.bounds, detail: detail.bounds });
  }
  const image = decodePng(files.get(groundTexture));
  const points = functions.plantingPoints(image.pixels, image.width, image.height);
  const trees = [];
  for (const species of ['canopy', 'roadside']) {
    const src = await asset(`models/campus/${species}-tree.glb`);
    const sourceBounds = new THREE.Box3().setFromObject(boundsScene(gltfs.get(src)));
    const center = sourceBounds.getCenter(new THREE.Vector3());
    const sourceHeight = sourceBounds.getSize(new THREE.Vector3()).y;
    const origin = new THREE.Matrix4().makeTranslation(-center.x, -sourceBounds.min.y, -center.z);
    const instances = points.filter((point) => point.species === species);
    const bounds = new THREE.Box3();
    const matrices = instances.map(({ point: [x, y], height, yaw }) => {
      const position = functions.pixelToWorld([x * functions.expandedGround.widthPixels / 1545, y * functions.expandedGround.heightPixels / 1018], .08);
      const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const placement = new THREE.Matrix4().compose(position, rotation, new THREE.Vector3().setScalar(height / sourceHeight)).multiply(origin);
      const treeBounds = sourceBounds.clone().applyMatrix4(placement); bounds.union(treeBounds);
      assert.ok(Math.abs(treeBounds.min.y - .08) < 1e-7, 'Trees must sit at source ground level');
      return placement.toArray();
    });
    series.push({ id: `campus-trees-${species}`, name: species === 'canopy' ? '园区乔木' : '道路树木', type: 'instances', src,
      position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
      reflection: .55, instanceMatrices: matrices,
      instanceColors: instances.map((_, i) => `#${new THREE.Color().setScalar(.86 + functions.random(i + 5) * .16).getHexString()}`) });
    trees.push({ species, count: matrices.length, bounds: boundsRecord(bounds) });
  }
  const timestamp = new Date().toISOString();
  const document = {
    format: 'three-auto-creator', version: 1,
    project: { id: 'campus-expanded', name: '研发园区扩展版', createdAt: timestamp, updatedAt: timestamp },
    editor: {
      config: {
        id: '_scene', name: '研发园区扩展版',
        camera: { type: 'PerspectiveCamera', fov: 45, near: .5, far: 2000, position: { x: 0, y: 700, z: -500 }, target: { x: 0, y: 0, z: 0 },
          controls: { enable: true, enableDamping: true, enablePan: true, design: true, minDistance: 70, maxDistance: 1400, maxPolarAngle: Math.PI / 2.08 } },
        size: { type: 'parent', id: '_scene' },
        renderer: { antialias: true, alpha: false, clearColor: '#c9dce8', clearAlpha: 1, exposure: 1.1 },
        fog: { show: true, color: '#c9dce8', near: 800, far: 1500 }, shadow: { show: false },
        environment: { src: environment, background: true, intensity: .35 },
        lighting: { hemisphere: { sky: '#e8f5ff', ground: '#738167', intensity: 1.15 },
          sun: { color: '#fff4dc', intensity: 1.6, position: { x: -90, y: 160, z: 55 }, castShadow: false } },
        series,
      },
      effectsEnabled: false, activeEffect: 'moebius', effectIntensity: 1,
      ambientIntensity: 1.15, ambientEnabled: true, lightColor: '#fff4dc', lightAlpha: 1,
      shadowType: 'low-faster', expandedSections: { light: true, effects: false, fog: false, shadow: false },
    },
    assets: { materials: [], colors: [], images: [], medias: [], audios: [] },
  };
  const manifest = `${JSON.stringify(document, null, 2)}\n`;
  const entries = { 'project.json': [strToU8(manifest), { level: 6 }] };
  for (const [name, bytes] of files) entries[name] = [bytes, { level: /\.(png|webp)$/.test(name) ? 0 : 6 }];
  const archive = zipSync(entries, { level: 6 });
  const unpacked = unzipSync(archive);
  assert.equal(Object.keys(unpacked).length, files.size + 1, 'Archive must include every resource');
  for (const resource of resources) assert.equal(digest(unpacked[resource.path]), resource.sha256, `Archive must preserve original bytes: ${resource.path}`);
  assert.equal(JSON.parse(Buffer.from(unpacked['project.json']).toString()).editor.config.series.length, 7, 'All campus series must be present');
  const sourceFiles = ['src/campusExpanded.ts', 'src/campus/buildingLayout.ts', 'src/campus-expanded/landmarkLayout.ts', 'src/campus-expanded/layout.ts', 'src/campus-expanded/trees.ts', 'src/campus-expanded/ground.ts'];
  const report = {
    project: document.project.name, format: document.format, version: document.version,
    generatedAt: timestamp, sourceLayout: 'three-auto/packages/examples',
    validation: { passed: true, resourceBytesPreserved: true, assetMatricesMatchSource: true, sourceFiles: await Promise.all(sourceFiles.map(async (file) => ({ path: file, sha256: digest(await readFile(path.join(examples, file))) }))) },
    seriesCount: series.length, modelCount: landmarks.length, treeCount: points.length,
    ground: { width: series[0].width, depth: series[0].depth, textureWidth: image.width, textureHeight: image.height },
    landmarks, trees, resources, resourceCount: resources.length,
    rawResourceBytes: resources.reduce((sum, resource) => sum + resource.bytes, 0), archiveBytes: archive.byteLength,
  };
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'project.json'), manifest);
  await writeFile(path.join(output, 'campus.threeauto'), archive);
  await writeFile(path.join(output, 'campus-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = process.argv[2] ?? path.resolve(creatorDirectory, '../three-auto');
  const output = path.resolve(process.argv[3] ?? path.join(creatorDirectory, 'public/projects/campus'));
  const report = await generateCampus(source, output);
  console.log(JSON.stringify({ output, series: report.seriesCount, landmarks: report.modelCount, trees: report.treeCount,
    treeSpecies: report.trees.map(({ species, count }) => ({ species, count })), resources: report.resourceCount,
    rawBytes: report.rawResourceBytes, archiveBytes: report.archiveBytes, validation: 'passed' }, null, 2));
}
