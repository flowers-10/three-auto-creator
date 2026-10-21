import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'three/addons/libs/fflate.module.js';
import { encodeProject, decodeProject, exportWebsite } from '../src/project/archive';
import type { ProjectData, ProjectDocument } from '../src/project/types';

function fixture(): ProjectData {
  const document: ProjectDocument = {
    format: 'three-auto-creator', version: 1,
    project: { id: 'campus-1', name: '智慧园区', createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T01:00:00.000Z' },
    editor: {
      config: { series: [
        { id: 'campus', type: 'group', name: '校园' },
        { id: 'building', parentId: 'campus', type: 'model', src: 'assets/building.glb', detailSrc: 'assets/detail.glb', position: { x: 1, y: 2, z: 3 }, scale: { x: 1, y: 1, z: 1 } },
        { id: 'ground', type: 'ground', texture: 'assets/map.webp' },
        { id: 'trees', type: 'instances', src: 'assets/tree.glb', instanceMatrices: [[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 2, 1, 1]] },
        { id: 'glass', type: 'glass', mask: 'assets/mask.png' },
      ], environment: { src: 'assets/environment.hdr' }, futureOption: { enabled: true } },
      effectsEnabled: false, activeEffect: 'moebius', effectIntensity: 1, ambientIntensity: 1,
      ambientEnabled: true, lightColor: '#ffffff', lightAlpha: 1, shadowType: 'low-faster', expandedSections: { light: true },
    },
    assets: { materials: [], colors: [], images: [{ id: 'image', name: '地图', type: 'image', value: 'assets/map.webp' }], medias: [], audios: [] },
  };
  const files = new Map([
    ['assets/building.glb', new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0, 255, 128, 7])],
    ['assets/detail.glb', new Uint8Array([0, 4, 3, 2, 1])],
    ['assets/map.webp', new Uint8Array([0x52, 0x49, 0x46, 0x46, 255])],
    ['assets/tree.glb', new Uint8Array([7, 8, 9])],
    ['assets/mask.png', new Uint8Array([137, 80, 78, 71])],
    ['assets/environment.hdr', new Uint8Array([35, 63, 82, 65])],
  ]);
  return { document, files };
}

function rawArchive(data: ProjectData, extra: Record<string, Uint8Array> = {}): Uint8Array {
  return zipSync({ 'project.json': strToU8(JSON.stringify(data.document)), ...Object.fromEntries(data.files), ...extra }, { level: 0 });
}

// Losing an unknown field or treating binary assets as text breaks an editable round trip.
test('project archive round trips document, unknown fields, and binary resources', () => {
  const source = fixture();
  (source.document as any).futureDocument = { revision: 9 };
  (source.document.editor.config.series[1] as any).futureModel = [1, 'preserved'];
  const decoded = decodeProject(encodeProject(source));
  assert.deepEqual(decoded.document, source.document);
  assert.deepEqual([...decoded.files], [...source.files]);
  decoded.files.get('assets/building.glb')![0] = 0;
  assert.equal(source.files.get('assets/building.glb')![0], 0x67);
});

test('encoding and exporting a website do not mutate caller data', () => {
  const source = fixture();
  const beforeDocument = JSON.stringify(source.document);
  const beforeFiles = [...source.files].map(([name, bytes]) => [name, [...bytes]]);
  encodeProject(source);
  exportWebsite(source, 'console.log("offline runtime");');
  assert.equal(JSON.stringify(source.document), beforeDocument);
  assert.deepEqual([...source.files].map(([name, bytes]) => [name, [...bytes]]), beforeFiles);
});

test('website contains a local module runtime, portable project, binary assets, and server instructions', () => {
  const source = fixture();
  source.document.project.name = '<script>alert("x")</script> & campus';
  const files = unzipSync(exportWebsite(source, 'window.offlineRuntime = true;'));
  const html = strFromU8(files['index.html']);
  assert.match(html, /src="\.\/runtime\.js"/);
  assert.match(html, /type="module"/);
  assert.ok(!html.includes('<script>alert("x")</script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.equal(strFromU8(files['runtime.js']), 'window.offlineRuntime = true;');
  assert.equal(JSON.parse(strFromU8(files['project.json'])).project.name, source.document.project.name);
  assert.deepEqual(files['assets/building.glb'], source.files.get('assets/building.glb'));
  assert.match(strFromU8(files['README.txt']), /http\.server|static server/);
  assert.match(strFromU8(files['README.txt']), /file:\/\//);
  assert.ok(!html.includes('https://'));
});

test('embedded data resources remain self contained', () => {
  const source = fixture();
  source.document.editor.config.series[2].texture = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(decodeProject(encodeProject(source)).document.editor.config.series[2].texture, 'data:image/png;base64,iVBORw0KGgo=');
});

test('rejects unsupported format and version before replacing a project', () => {
  for (const patch of [{ format: 'foreign' }, { version: 2 }]) {
    const source = fixture();
    Object.assign(source.document, patch);
    assert.throws(() => decodeProject(rawArchive(source)), /format|version/i);
  }
});

test('rejects malformed project metadata, editor configuration, and asset lists', () => {
  const edits = [
    (d: any) => { d.project.name = ''; },
    (d: any) => { d.project.createdAt = 'yesterday'; },
    (d: any) => { d.editor.config.series = {}; },
    (d: any) => { d.assets.images = {}; },
    (d: any) => { d.editor.effectIntensity = 'high'; },
  ];
  for (const edit of edits) {
    const source = fixture(); edit(source.document);
    assert.throws(() => decodeProject(rawArchive(source)), /project|series|assets|effectIntensity/i);
  }
});

test('rejects duplicate series or asset ids', () => {
  const source = fixture();
  source.document.editor.config.series.push({ id: 'building', type: 'cube' });
  assert.throws(() => decodeProject(rawArchive(source)), /duplicate.*id/i);
  const other = fixture();
  other.document.assets.audios.push({ id: 'image', name: 'collision', type: 'audio', value: 'assets/environment.hdr' });
  assert.throws(() => decodeProject(rawArchive(other)), /duplicate.*id/i);
});

test('rejects parent cycles and missing parents', () => {
  const source = fixture();
  source.document.editor.config.series[0].parentId = 'building';
  assert.throws(() => decodeProject(rawArchive(source)), /cycle/i);
  const other = fixture();
  other.document.editor.config.series[1].parentId = 'absent';
  assert.throws(() => decodeProject(rawArchive(other)), /parent/i);
});

test('rejects nonfinite transforms and malformed instance matrices', () => {
  const source = fixture();
  source.document.editor.config.series[1].position.x = Infinity;
  assert.throws(() => encodeProject(source), /finite|position/i);
  const other = fixture();
  other.document.editor.config.series[3].instanceMatrices = [[1, 2, 3]];
  assert.throws(() => decodeProject(rawArchive(other)), /matrix|matrices/i);
});

test('rejects traversal, absolute paths, backslashes, encoded traversal, and foreign root files', () => {
  for (const path of ['../escape.glb', '/assets/escape.glb', 'assets/../escape.glb', 'assets\\escape.glb', 'assets/%2e%2e/escape.glb', 'assets//escape.glb', 'runtime.js']) {
    const source = fixture();
    assert.throws(() => decodeProject(rawArchive(source, { [path]: new Uint8Array([1]) })), /path|assets|archive/i, path);
  }
});

test('every referenced model, detail, ground, instance, environment, glass, and library asset must exist', () => {
  for (const path of fixture().files.keys()) {
    const source = fixture(); source.files.delete(path);
    assert.throws(() => decodeProject(rawArchive(source)), /missing.*asset|asset.*missing/i, path);
  }
  const source = fixture();
  source.document.assets.images[0].value = 'assets/library-only.webp';
  assert.throws(() => encodeProject(source), /missing.*asset|asset.*missing/i);
});

test('external, temporary, and unsafe resource URLs report a bundling requirement', () => {
  for (const url of ['https://example.com/model.glb', '//example.com/model.glb', 'blob:temporary', 'javascript:alert(1)', 'file:///tmp/model.glb', '/campus/model.glb']) {
    const source = fixture(); source.document.editor.config.series[1].src = url;
    assert.throws(() => encodeProject(source), /bundl|portable|asset|unsupported|unsafe/i, url);
    assert.throws(() => exportWebsite(source, '// runtime'), /bundl|portable|asset|unsupported|unsafe/i, url);
  }
});

test('rejects missing model sources and project manifests', () => {
  const source = fixture(); delete source.document.editor.config.series[1].src;
  assert.throws(() => encodeProject(source), /src|source/i);
  assert.throws(() => decodeProject(zipSync({ 'assets/a.glb': new Uint8Array([1]) })), /project\.json/i);
});

test('rejects oversized manifests and archives with too many files before extraction', () => {
  const source = fixture(); (source.document as any).padding = 'a'.repeat(4 * 1024 * 1024);
  assert.throws(() => decodeProject(rawArchive(source)), /manifest|project\.json|4.*MiB|limit/i);
  const extra: Record<string, Uint8Array> = {};
  for (let i = 0; i < 2001; i++) extra[`assets/${i}.bin`] = new Uint8Array();
  assert.throws(() => decodeProject(rawArchive(fixture(), extra)), /2000|many files|file.*limit/i);
});

test('rejects a central directory claiming a huge uncompressed resource before allocating it', () => {
  const bytes = rawArchive(fixture());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < bytes.length - 46; i++) {
    if (view.getUint32(i, true) === 0x02014b50 && view.getUint16(i + 28, true) > 12) {
      view.setUint32(i + 24, 300 * 1024 * 1024, true);
      break;
    }
  }
  assert.throws(() => decodeProject(bytes), /256|large|limit|size/i);
});

test('rejects malformed JSON and random nonzip data', () => {
  assert.throws(() => decodeProject(zipSync({ 'project.json': strToU8('{broken') })), /JSON|manifest|project/i);
  assert.throws(() => decodeProject(new Uint8Array([1, 2, 3])), /archive|ZIP/i);
});

test('rejects malformed optional resource references', () => {
  for (const [seriesIndex, key] of [[1, 'detailSrc'], [2, 'texture'], [4, 'mask']] as const) {
    const source = fixture(); source.document.editor.config.series[seriesIndex][key] = { invalid: true };
    assert.throws(() => encodeProject(source), /source|asset|string/i);
  }
});

test('rejects duplicate archive filenames rather than silently overwriting resources', () => {
  const source = fixture();
  const bytes = rawArchive(source, { 'assets/alpha.bin': new Uint8Array([1]), 'assets/bravo.bin': new Uint8Array([2]) });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < bytes.length - 46; i++) {
    if (view.getUint32(i, true) === 0x02014b50) {
      const length = view.getUint16(i + 28, true);
      if (strFromU8(bytes.subarray(i + 46, i + 46 + length)) === 'assets/bravo.bin') {
        bytes.set(strToU8('assets/alpha.bin'), i + 46);
        break;
      }
    }
  }
  assert.throws(() => decodeProject(bytes), /duplicate.*path/i);
});

test('rejects excessive total declared size before inflating any resource', () => {
  const source = fixture();
  const bytes = rawArchive(source);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let resources = 0;
  for (let i = 0; i < bytes.length - 46 && resources < 3; i++) {
    if (view.getUint32(i, true) === 0x02014b50 && view.getUint16(i + 28, true) > 12) {
      view.setUint32(i + 24, 200 * 1024 * 1024, true);
      resources++;
    }
  }
  assert.throws(() => decodeProject(bytes), /total|512.*MiB/i);
});


test('website bootstrap fetches its project and mounts the offline canvas with relative assets', async () => {
  const source = fixture();
  source.document.editor.effectsEnabled = true;
  source.document.editor.activeEffect = 'moebius';
  source.document.editor.effectIntensity = 0.65;
  const files = unzipSync(exportWebsite(source, '// runtime'));
  const html = strFromU8(files['index.html']);
  assert.match(html, /<canvas[^>]+id="app"/);
  const bootstrap = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(bootstrap, 'website must bootstrap its viewer');
  const canvas = {};
  let removed = false;
  const status = { textContent: '', remove: () => { removed = true; }, setAttribute() {} };
  let mounted: any;
  let requested = '';
  await vm.runInNewContext(`(async () => { ${bootstrap} })()`, {
    URL, Error,
    document: { baseURI: 'http://localhost:8080/campus/index.html', getElementById: (id: string) => id === 'app' ? canvas : status },
    fetch: async (url: URL) => { requested = String(url); return { ok: true, json: async () => source.document }; },
    CreatorViewer: { mount: (options: any) => { mounted = options; return { ready: Promise.resolve() }; } },
  });
  assert.equal(requested, 'http://localhost:8080/campus/project.json');
  assert.equal(mounted.canvas, canvas);
  assert.equal(mounted.config, source.document.editor.config);
  assert.equal(mounted.editor?.effectsEnabled, true);
  assert.equal(mounted.editor?.activeEffect, 'moebius');
  assert.equal(mounted.editor?.effectIntensity, 0.65);
  assert.equal(mounted.resolveAsset('assets/building.glb'), 'http://localhost:8080/campus/assets/building.glb');
  assert.equal(removed, true);
});

test('website bootstrap shows project loading failures to the visitor', async () => {
  const html = strFromU8(unzipSync(exportWebsite(fixture(), '// runtime'))['index.html']);
  const bootstrap = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(bootstrap, 'website must bootstrap its viewer');
  const status = { textContent: '', remove: () => assert.fail('failure message should stay visible'), setAttribute() {} };
  await vm.runInNewContext(`(async () => { ${bootstrap} })()`, {
    URL, Error,
    document: { baseURI: 'http://localhost:8080/index.html', getElementById: () => status },
    fetch: async () => ({ ok: false, status: 404 }),
  });
  assert.match(status.textContent, /404/);
});

test('rejects corrupted binary resources before they can replace editor state', () => {
  const bytes = rawArchive(fixture());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < bytes.length - 30; i++) {
    if (view.getUint32(i, true) !== 0x04034b50) continue;
    const length = view.getUint16(i + 26, true);
    if (strFromU8(bytes.subarray(i + 30, i + 30 + length)) === 'assets/building.glb') {
      bytes[i + 30 + length + view.getUint16(i + 28, true)] ^= 255;
      break;
    }
  }
  assert.throws(() => decodeProject(bytes), /checksum|corrupt|CRC/i);
});
