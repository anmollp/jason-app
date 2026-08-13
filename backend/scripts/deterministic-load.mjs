import { pathToFileURL } from 'node:url';

const DOCUMENT_BYTES = 5 * 1024 * 1024 - 1024;
const DEFAULT_REQUESTS_PER_TOOL = 5;
const DEFAULT_TIMEOUT_MILLIS = 60_000;
const PHASES = [1, 4];

export function assertLoopbackBaseUrl(value) {
  const url = new URL(value);
  const loopbackHosts = new Set(['127.0.0.1', '[::1]']);

  if (
    url.protocol !== 'http:' ||
    !loopbackHosts.has(url.hostname) ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error('LOAD_BASE_URL must be an HTTP loopback origin.');
  }

  return url;
}

export function createDocument(targetBytes = DOCUMENT_BYTES) {
  const empty = JSON.stringify({ marker: 'before', payload: '' });
  const payloadBytes = targetBytes - Buffer.byteLength(empty);
  if (payloadBytes < 0) {
    throw new Error('The target document size is too small.');
  }

  const document = JSON.stringify({
    marker: 'before',
    payload: 'x'.repeat(payloadBytes),
  });
  if (Buffer.byteLength(document) !== targetBytes) {
    throw new Error('Unable to create the requested document size.');
  }
  return document;
}

export function createWorkload(document, requestsPerTool) {
  const expectedPayload = JSON.parse(document).payload;
  const after = document.replace('"marker":"before"', '"marker":"after"');
  const cases = [
    {
      tool: 'format',
      body: { input: document },
      validate: (result) => {
        const output = JSON.parse(result.output);
        return output.marker === 'before' && output.payload === expectedPayload;
      },
    },
    {
      tool: 'diff',
      body: { before: document, after },
      validate: (result) =>
        result.summary?.changes === 1 &&
        JSON.stringify(result.operations) ===
          '[{"op":"replace","path":"/marker","value":"after"}]',
    },
    {
      tool: 'patch',
      body: {
        document,
        patch: '[{"op":"replace","path":"/marker","value":"after"}]',
      },
      validate: (result) => {
        const output = JSON.parse(result.output);
        return (
          output.marker === 'after' &&
          output.payload === expectedPayload &&
          result.summary?.operations === 1
        );
      },
    },
    {
      tool: 'pointer',
      body: { document, path: '/marker' },
      validate: (result) =>
        JSON.parse(result.output) === 'before' &&
        result.summary?.found === true,
    },
  ];

  return Array.from({ length: requestsPerTool }, () => cases).flat();
}

export async function runPhase({
  baseUrl,
  concurrency,
  document,
  fetchImpl = fetch,
  now = () => performance.now(),
  requestsPerTool = DEFAULT_REQUESTS_PER_TOOL,
  timeoutMillis = DEFAULT_TIMEOUT_MILLIS,
}) {
  const validatedBaseUrl = assertLoopbackBaseUrl(baseUrl.toString());
  const pending = createWorkload(document, requestsPerTool);
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < pending.length) {
      const testCase = pending[nextIndex++];
      results.push(
        await runRequest({
          baseUrl: validatedBaseUrl,
          fetchImpl,
          now,
          testCase,
          timeoutMillis,
        }),
      );
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, worker),
  );

  const durations = results.map(({ durationMillis }) => durationMillis);
  return {
    concurrency,
    requests: results.length,
    passed: results.filter(({ ok }) => ok).length,
    failed: results.filter(({ ok }) => !ok).length,
    p50Millis: percentile(durations, 50),
    p95Millis: percentile(durations, 95),
    byTool: Object.fromEntries(
      ['format', 'diff', 'patch', 'pointer'].map((tool) => {
        const toolResults = results.filter((entry) => entry.tool === tool);
        return [
          tool,
          {
            requests: toolResults.length,
            passed: toolResults.filter(({ ok }) => ok).length,
            p95Millis: percentile(
              toolResults.map(({ durationMillis }) => durationMillis),
              95,
            ),
          },
        ];
      }),
    ),
    failures: results
      .filter(({ ok }) => !ok)
      .map(({ tool, code }) => ({ tool, code })),
  };
}

async function runRequest({
  baseUrl,
  fetchImpl,
  now,
  testCase,
  timeoutMillis,
}) {
  const startedAt = now();
  try {
    const response = await fetchImpl(new URL(testCase.tool, baseUrl), {
      body: JSON.stringify(testCase.body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMillis),
    });
    if (!response.ok) {
      return result(testCase.tool, `HTTP_${response.status}`, startedAt, now);
    }

    const body = await response.json();
    return result(
      testCase.tool,
      testCase.validate(body) ? undefined : 'INVALID_RESULT',
      startedAt,
      now,
    );
  } catch (error) {
    const code =
      error instanceof DOMException && error.name === 'TimeoutError'
        ? 'TIMEOUT'
        : 'REQUEST_FAILED';
    return result(testCase.tool, code, startedAt, now);
  }
}

function result(tool, code, startedAt, now) {
  return {
    tool,
    ok: code === undefined,
    ...(code ? { code } : {}),
    durationMillis: Math.round((now() - startedAt) * 100) / 100,
  };
}

function percentile(values, percentileRank) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  return sorted[Math.max(index, 0)];
}

async function main() {
  const baseUrl = assertLoopbackBaseUrl(
    process.env.LOAD_BASE_URL ?? 'http://127.0.0.1:3000/',
  );
  const document = createDocument();
  const phases = [];

  for (const concurrency of PHASES) {
    phases.push(await runPhase({ baseUrl, concurrency, document }));
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    target: baseUrl.origin,
    documentBytes: Buffer.byteLength(document),
    phases,
    ready: phases.every(({ failed }) => failed === 0),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ready) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    process.stderr.write(
      `${JSON.stringify({ code: 'LOAD_HARNESS_FAILED' })}\n`,
    );
    process.exitCode = 1;
  });
}
