import { chmod } from 'node:fs/promises';
import { build } from 'esbuild';

await build({
  banner: { js: '#!/usr/bin/env node' },
  bundle: true,
  entryPoints: ['src/index.ts'],
  format: 'esm',
  outfile: 'dist/index.js',
  platform: 'node',
  target: 'node22',
});

await chmod('dist/index.js', 0o755);
