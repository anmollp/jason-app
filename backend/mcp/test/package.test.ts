import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

void describe('local package', () => {
  void it('is private, executable, minimal, and provider-neutral', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as {
      private?: boolean;
      publishConfig?: unknown;
      dependencies?: Record<string, string>;
    };
    assert.equal(manifest.private, true);
    assert.equal(manifest.publishConfig, undefined);
    assert.deepEqual(Object.keys(manifest.dependencies ?? {}).sort(), [
      '@modelcontextprotocol/server',
      'ajv',
    ]);

    const entrypoint = new URL('../dist/index.js', import.meta.url);
    await access(entrypoint, constants.X_OK);
    const output = await readFile(entrypoint, 'utf8');
    assert.match(output, /^#!\/usr\/bin\/env node/);
    assert.doesNotMatch(output, /(?:openai|codex)/i);

    const cache = await mkdtemp(join(tmpdir(), 'jason-mcp-npm-'));
    try {
      const packed = JSON.parse(
        execFileSync('npm', ['pack', '--dry-run', '--json'], {
          cwd: new URL('..', import.meta.url),
          encoding: 'utf8',
          env: { ...process.env, npm_config_cache: cache },
        }),
      ) as Array<{ files: Array<{ path: string }> }>;
      assert.deepEqual(packed[0]?.files.map((file) => file.path).sort(), [
        'README.md',
        'dist/index.js',
        'package.json',
      ]);
    } finally {
      await rm(cache, { recursive: true });
    }
  });
});
