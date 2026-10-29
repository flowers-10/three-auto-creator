import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

// Public scene resources must never be copied into the editor distribution.
const editorAssets = (): Plugin => {
  let publicDir: string;
  return {
    name: 'editor-public-assets',
    apply: 'build',
    configResolved(config) { publicDir = config.publicDir; },
    async generateBundle() {
      for (const fileName of ['three-auto.ico', 'export-runtime.js']) {
        this.emitFile({ type: 'asset', fileName, source: await readFile(path.join(publicDir, fileName)) });
      }
    },
  };
};

// Older Vite 6 typings predate the allowedHosts option.
const hostOptions = { host: true, port: 2025, strictPort: true, allowedHosts: true as const };

export default defineConfig({
  base: './',
  plugins: [vue(), editorAssets()],
  build: { copyPublicDir: false },
  server: hostOptions,
  preview: hostOptions,
});
