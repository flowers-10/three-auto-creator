import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
await build({
  absWorkingDir: project,
  entryPoints: ['src/project/viewer.ts'],
  outfile: 'public/export-runtime.js',
  bundle: true,
  format: 'iife',
  globalName: 'CreatorViewer',
  footer: { js: 'globalThis.CreatorViewer = CreatorViewer;' },
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'inline',
});
console.log('Built the self-contained offline viewer: public/export-runtime.js');
