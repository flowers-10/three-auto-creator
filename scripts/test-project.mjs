import { build } from 'esbuild';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const entries = (await readdir(path.join(root, 'tests'))).filter(name => name.endsWith('.test.ts'));
if (!entries.length) throw new Error('No tests/*.test.ts files found');
const output = await mkdtemp(path.join(tmpdir(), 'three-auto-project-tests-'));
try {
  await build({
    absWorkingDir: root,
    entryPoints: entries.map(name => path.join('tests', name)),
    outdir: output,
    outExtension: { '.js': '.mjs' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    sourcemap: 'inline',
    target: 'node20',
    logLevel: 'warning',
  });
  const run = spawnSync(process.execPath, ['--test', ...entries.map(name => path.join(output, name.replace(/\.ts$/, '.mjs')))], { cwd: root, stdio: 'inherit' });
  if (run.error) throw run.error;
  process.exitCode = run.status ?? 1;
} finally {
  await rm(output, { recursive: true, force: true });
}
