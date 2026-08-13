import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  Client,
  InMemoryTransport,
  ReadBuffer,
  serializeMessage,
  type JSONRPCMessage,
  type Transport,
} from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import {
  JasonCliRunner,
  minimalJasonEnvironment,
} from '../../src/jason-cli.runner.js';
import { createJasonMcpServer } from '../src/server.js';

const cliPath = process.env.JASON_CLI_PATH;

void describe('Jason v1.7.0 integration', { skip: !cliPath }, () => {
  void it('executes all four tools through the generic MCP protocol', async () => {
    const server = createJasonMcpServer({
      commands: new JasonCliRunner({
        cliPath,
        environment: minimalJasonEnvironment(),
        maxConcurrentRuns: 1,
        maxStderrBytes: 64 * 1024,
        maxStdoutBytes: 1024 * 1024,
      }),
    });
    const client = new Client({ name: 'integration-test', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const formatted = await client.callTool({
        name: 'format_json',
        arguments: { input: '{"a":1}' },
      });
      assert.deepEqual(formatted.structuredContent, {
        output: '{\n  "a": 1\n}',
      });

      const diff = await client.callTool({
        name: 'diff_json',
        arguments: { before: '{"a":1}', after: '{"a":2}' },
      });
      assert.deepEqual(diff.structuredContent, {
        operations: [{ op: 'replace', path: '/a', value: 2 }],
        summary: { changes: 1, added: 0, removed: 0, replaced: 1 },
      });

      const patched = await client.callTool({
        name: 'apply_json_patch',
        arguments: {
          document: '{"a":1}',
          patch: '[{"op":"replace","path":"/a","value":2}]',
        },
      });
      assert.deepEqual(patched.structuredContent, {
        output: '{\n  "a": 2\n}',
        summary: { operations: 1, added: 0, removed: 0, replaced: 1 },
      });

      const pointer = await client.callTool({
        name: 'resolve_json_pointer',
        arguments: { document: '{"a":2}', path: '/a' },
      });
      assert.deepEqual(pointer.structuredContent, {
        output: '2',
        summary: {
          depth: 1,
          found: true,
          issues: 0,
          kind: 'number',
          path: '/a',
        },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  void it('launches the built entrypoint through standard MCP stdio', async () => {
    const client = new Client({ name: 'stdio-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('../dist/index.js', import.meta.url))],
      env: {
        JASON_CLI_PATH: cliPath as string,
        PATH: process.env.PATH ?? '',
      },
      stderr: 'pipe',
      maxBufferSize: 1024 * 1024,
    });
    await client.connect(transport);

    try {
      const { tools } = await client.listTools();
      assert.deepEqual(
        tools.map((tool) => tool.name),
        [
          'format_json',
          'diff_json',
          'apply_json_patch',
          'resolve_json_pointer',
        ],
      );
      const result = await client.callTool({
        name: 'format_json',
        arguments: { input: '{"portable":true}' },
      });
      assert.deepEqual(result.structuredContent, {
        output: '{\n  "portable": true\n}',
      });
    } finally {
      await client.close();
    }
  });

  void it('stops an active CLI child and exits cleanly on SIGTERM', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'jason-mcp-shutdown-'));
    const marker = join(directory, 'child.pid');
    const stubbornCli = join(directory, 'jason');
    await writeFile(
      stubbornCli,
      `#!${process.execPath}\n` +
        `import { writeFileSync } from 'node:fs';\n` +
        `writeFileSync(${JSON.stringify(marker)}, String(process.pid));\n` +
        `process.on('SIGTERM', () => {});\n` +
        `setInterval(() => {}, 1_000);\n`,
    );
    await chmod(stubbornCli, 0o755);

    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('../dist/index.js', import.meta.url))],
      {
        env: {
          JASON_CLI_PATH: stubbornCli,
          PATH: process.env.PATH ?? '',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    const client = new Client({ name: 'shutdown-test', version: '1.0.0' });
    const transport = new SpawnedProcessTransport(child);
    let cliPid: number | undefined;
    try {
      await client.connect(transport);
      const activeCall = client
        .callTool({ name: 'format_json', arguments: { input: '{}' } })
        .catch(() => undefined);
      cliPid = Number(await waitForFile(marker));

      child.kill('SIGTERM');
      const result = await waitForExit(child, 2_000);
      assert.equal(result.code, 0);
      assert.equal(result.signal, null);
      assertProcessStopped(cliPid);
      await activeCall;
    } finally {
      await client.close();
      await stopProcess(child);
      if (cliPid !== undefined) stopPid(cliPid);
      await rm(directory, { recursive: true });
    }
  });
});

async function waitForFile(path: string): Promise<string> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('Jason MCP did not start the CLI child.');
}

function assertProcessStopped(pid: number): void {
  assert.throws(
    () => process.kill(pid, 0),
    (error: NodeJS.ErrnoException) => error.code === 'ESRCH',
  );
}

class SpawnedProcessTransport implements Transport {
  readonly buffer = new ReadBuffer({ maxBufferSize: 1024 * 1024 });
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(private readonly child: ChildProcessWithoutNullStreams) {}

  start(): Promise<void> {
    this.child.once('close', () => this.onclose?.());
    this.child.once('error', (error) => this.onerror?.(error));
    this.child.stdout.on('data', (chunk: Buffer) => {
      this.buffer.append(chunk);
      for (let message = this.buffer.readMessage(); message; ) {
        this.onmessage?.(message);
        message = this.buffer.readMessage();
      }
    });
    return Promise.resolve();
  }

  send(message: JSONRPCMessage): Promise<void> {
    return new Promise((resolve) => {
      if (this.child.stdin.write(serializeMessage(message))) {
        resolve();
      } else {
        this.child.stdin.once('drain', resolve);
      }
    });
  }

  close(): Promise<void> {
    this.child.stdin.end();
    return Promise.resolve();
  }
}

function waitForExit(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
}> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Jason MCP did not stop after SIGTERM.')),
      timeoutMs,
    );
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
}

async function stopProcess(
  child: ChildProcessWithoutNullStreams,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGKILL');
  await waitForExit(child, 2_000).catch(() => undefined);
}

function stopPid(pid: number): void {
  try {
    process.kill(pid, 'SIGKILL');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}
