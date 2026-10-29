import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'vite';

const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url));

test('editor build copies its runtime and icon without shipping scene resources', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'three-auto-build-')));
  try {
    const publicDir = path.join(root, 'public');
    await mkdir(path.join(publicDir, 'projects'), { recursive: true });
    await mkdir(path.join(publicDir, 'textures'), { recursive: true });
    await Promise.all([
      writeFile(path.join(root, 'index.html'), '<script type="module" src="/main.js"></script>'),
      writeFile(path.join(root, 'main.js'), 'console.log("editor");'),
      writeFile(path.join(publicDir, 'three-auto.ico'), 'editor icon'),
      writeFile(path.join(publicDir, 'export-runtime.js'), 'globalThis.CreatorViewer = {};'),
      writeFile(path.join(publicDir, 'projects', 'scene.threeauto'), 'project archive'),
      writeFile(path.join(publicDir, 'textures', 'ground.png'), 'scene texture'),
      writeFile(path.join(publicDir, 'building.glb'), 'scene model'),
    ]);
    await build({ configFile, root, logLevel: 'silent' });
    const output = path.join(root, 'dist');
    assert.deepEqual((await readdir(output)).sort(), ['assets', 'export-runtime.js', 'index.html', 'three-auto.ico']);
    assert.equal(await readFile(path.join(output, 'export-runtime.js'), 'utf8'), 'globalThis.CreatorViewer = {};');
    assert.equal(await readFile(path.join(output, 'three-auto.ico'), 'utf8'), 'editor icon');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
