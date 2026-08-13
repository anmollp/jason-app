import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import {
  assertLoopbackBaseUrl,
  createDocument,
  createWorkload,
  runPhase,
} from '../scripts/deterministic-load.mjs';

describe('deterministic load harness', () => {
  it('refuses non-loopback and credential-bearing targets', () => {
    for (const target of [
      'https://askjason.dev/',
      'http://example.com/',
      'http://localhost:3000/',
      'http://user:secret@127.0.0.1:3000/',
      'http://127.0.0.1:3000/format',
    ]) {
      assert.throws(() => assertLoopbackBaseUrl(target));
    }

    assert.equal(
      assertLoopbackBaseUrl('http://127.0.0.1:3000/').origin,
      'http://127.0.0.1:3000',
    );
  });

  it('creates an exact near-5 MiB JSON document', () => {
    const document = createDocument();

    assert.equal(Buffer.byteLength(document), 5 * 1024 * 1024 - 1024);
    assert.equal(JSON.parse(document).marker, 'before');
  });

  it('rejects truncated and semantically incorrect success bodies', () => {
    const document = createDocument(1024);
    const [format, diff, patch] = createWorkload(document, 1);

    assert.equal(format.validate({ output: '{"marker":"before"}' }), false);
    assert.equal(
      diff.validate({
        operations: [{ op: 'replace', path: '/wrong', value: 'after' }],
        summary: { changes: 1 },
      }),
      false,
    );
    assert.equal(patch.validate({ output: '{"marker":"after"}' }), false);
  });

  it('covers every tool at the requested concurrency without retaining content', async () => {
    let active = 0;
    let maxActive = 0;
    const fetchImpl = async (url, options) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;

      const request = JSON.parse(options.body);
      const tool = new URL(url).pathname.slice(1);
      assert.equal(options.redirect, 'error');
      return responseFor(tool, request);
    };

    const phase = await runPhase({
      baseUrl: new URL('http://127.0.0.1:3000/'),
      concurrency: 4,
      document: createDocument(1024),
      fetchImpl,
      now: incrementalClock(),
      requestsPerTool: 2,
    });

    assert.equal(maxActive, 4);
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(phase.byTool).map(([tool, value]) => [
          tool,
          value.requests,
        ]),
      ),
      { diff: 2, format: 2, patch: 2, pointer: 2 },
    );
    assert.equal(phase.requests, 8);
    assert.equal(phase.passed, 8);
    assert.equal(phase.failed, 0);
    assert.deepEqual(phase.failures, []);
    assert.equal(JSON.stringify(phase).includes('payload'), false);
  });

  it('reports only safe failure classifications', async () => {
    const phase = await runPhase({
      baseUrl: new URL('http://127.0.0.1:3000/'),
      concurrency: 1,
      document: createDocument(1024),
      fetchImpl: async () => ({ ok: false, status: 503 }),
      requestsPerTool: 1,
    });

    assert.equal(phase.failed, 4);
    assert.deepEqual(phase.failures, [
      { tool: 'format', code: 'HTTP_503' },
      { tool: 'diff', code: 'HTTP_503' },
      { tool: 'patch', code: 'HTTP_503' },
      { tool: 'pointer', code: 'HTTP_503' },
    ]);
  });

  it('fails closed for redirects and timeouts', async () => {
    const redirect = await runPhase({
      baseUrl: new URL('http://127.0.0.1:3000/'),
      concurrency: 1,
      document: createDocument(1024),
      fetchImpl: async (_url, options) => {
        assert.equal(options.redirect, 'error');
        return { ok: false, status: 302 };
      },
      requestsPerTool: 1,
    });
    const timeout = await runPhase({
      baseUrl: new URL('http://127.0.0.1:3000/'),
      concurrency: 1,
      document: createDocument(1024),
      fetchImpl: async () => {
        throw new DOMException('private detail', 'TimeoutError');
      },
      requestsPerTool: 1,
    });

    assert.deepEqual(
      redirect.failures.map(({ code }) => code),
      ['HTTP_302', 'HTTP_302', 'HTTP_302', 'HTTP_302'],
    );
    assert.deepEqual(
      timeout.failures.map(({ code }) => code),
      ['TIMEOUT', 'TIMEOUT', 'TIMEOUT', 'TIMEOUT'],
    );
    assert.equal(JSON.stringify(timeout).includes('private detail'), false);
  });

  it('exits nonzero without exposing target details for an unsafe CLI target', () => {
    const execution = spawnSync(
      process.execPath,
      ['scripts/deterministic-load.mjs'],
      {
        cwd: new URL('..', import.meta.url),
        encoding: 'utf8',
        env: { ...process.env, LOAD_BASE_URL: 'https://askjason.dev/' },
      },
    );

    assert.equal(execution.status, 1);
    assert.equal(execution.stdout, '');
    assert.deepEqual(JSON.parse(execution.stderr), {
      code: 'LOAD_HARNESS_FAILED',
    });
  });
});

function responseFor(tool, request) {
  let body;
  switch (tool) {
    case 'format':
      body = { output: request.input };
      break;
    case 'diff':
      body = {
        operations: [{ op: 'replace', path: '/marker', value: 'after' }],
        summary: { changes: 1 },
      };
      break;
    case 'patch':
      body = {
        output: request.document.replace('before', 'after'),
        summary: { operations: 1 },
      };
      break;
    case 'pointer':
      body = { output: '"before"', summary: { found: true } };
      break;
    default:
      throw new Error('Unexpected tool.');
  }

  return {
    ok: true,
    json: async () => body,
  };
}

function incrementalClock() {
  let value = 0;
  return () => ++value;
}
