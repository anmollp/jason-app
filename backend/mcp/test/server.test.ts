import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { McpServer } from '@modelcontextprotocol/server';
import { AGENT_TOOL_DEFINITIONS } from '../../src/agent/contracts/tool-contracts.js';
import { JasonCliError } from '../../src/jason-cli.runner.js';
import {
  JsonToolExecutor,
  type JasonJsonCommands,
} from '../../src/json-tool.executor.js';
import { createJasonMcpServer } from '../src/server.js';

class FakeJasonCommands implements JasonJsonCommands {
  formatSignal?: AbortSignal;
  waitForFormatAbort = false;
  onFormatStarted?: () => void;
  onFormatCancelled?: () => void;

  format(input: string, signal?: AbortSignal): Promise<string> {
    this.formatSignal = signal;
    if (this.waitForFormatAbort) {
      this.onFormatStarted?.();
      return new Promise((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => {
            this.onFormatCancelled?.();
            reject(new JasonCliError('ABORTED', 'secret cancellation detail'));
          },
          { once: true },
        );
      });
    }
    return Promise.resolve(JSON.stringify(JSON.parse(input), null, 2));
  }

  diff(): Promise<string> {
    return Promise.resolve('[{"op":"replace","path":"/a","value":2}]');
  }

  patch(): Promise<string> {
    return Promise.resolve('{"a":2}');
  }

  pointer(): Promise<string> {
    return Promise.resolve('2');
  }
}

void describe('Jason MCP server', () => {
  let client: Client;
  let server: McpServer;

  beforeEach(async () => {
    server = createJasonMcpServer({ commands: new FakeJasonCommands() });
    client = new Client({ name: 'jason-mcp-test', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  void it('advertises exactly the shared web schemas and read-only annotations', async () => {
    const { tools } = await client.listTools();

    assert.deepEqual(
      tools.map((tool) => tool.name),
      AGENT_TOOL_DEFINITIONS.map((tool) => tool.name),
    );

    for (const definition of AGENT_TOOL_DEFINITIONS) {
      const tool = tools.find(
        (candidate) => candidate.name === definition.name,
      );
      assert.ok(tool);
      assert.deepEqual(tool.inputSchema, definition.inputSchema);
      assert.deepEqual(tool.outputSchema, definition.resultSchema);
      assert.deepEqual(tool.annotations, {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
  });

  void it('returns the same structured results as the shared web executor', async () => {
    const commands = new FakeJasonCommands();
    const executor = new JsonToolExecutor(commands);
    const cases = [
      {
        tool: 'format_json',
        arguments: { input: '{"a":1}' },
        expected: await executor.formatJson('{"a":1}'),
      },
      {
        tool: 'diff_json',
        arguments: { before: '{"a":1}', after: '{"a":2}' },
        expected: await executor.diffJson('{"a":1}', '{"a":2}'),
      },
      {
        tool: 'apply_json_patch',
        arguments: {
          document: '{"a":1}',
          patch: '[{"op":"replace","path":"/a","value":2}]',
        },
        expected: await executor.patchJson(
          '{"a":1}',
          '[{"op":"replace","path":"/a","value":2}]',
        ),
      },
      {
        tool: 'resolve_json_pointer',
        arguments: { document: '{"a":2}', path: '/a' },
        expected: await executor.pointerJson('{"a":2}', '/a'),
      },
    ];

    for (const testCase of cases) {
      const result = await client.callTool({
        name: testCase.tool,
        arguments: testCase.arguments,
      });
      assert.equal(result.isError, undefined);
      assert.deepEqual(result.structuredContent, testCase.expected);
      assert.equal(
        result.content[0]?.type === 'text' ? result.content[0].text : undefined,
        JSON.stringify(testCase.expected),
      );
    }
  });

  void it('enforces the combined 16 KiB limit and returns sanitized failures', async () => {
    const tooLarge = await client.callTool({
      name: 'diff_json',
      arguments: { before: 'a'.repeat(9_000), after: 'b'.repeat(9_000) },
    });
    assert.equal(tooLarge.isError, true);
    assert.match(textContent(tooLarge), /INVALID_INPUT/);

    await client.close();
    await server.close();

    const secret = 'provider-key-that-must-not-leak';
    const failingCommands = new FakeJasonCommands();
    failingCommands.format = () =>
      Promise.reject(new JasonCliError('RUST_REJECTED', secret));
    server = createJasonMcpServer({ commands: failingCommands });
    client = new Client({ name: 'jason-mcp-test', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const failure = await client.callTool({
      name: 'format_json',
      arguments: { input: '{}' },
    });
    assert.equal(failure.isError, true);
    assert.match(textContent(failure), /JASON_REJECTED/);
    assert.doesNotMatch(JSON.stringify(failure), new RegExp(secret));

    failingCommands.diff = () => Promise.resolve('not-json');
    const malformed = await client.callTool({
      name: 'diff_json',
      arguments: { before: '{}', after: '{"a":1}' },
    });
    assert.equal(malformed.isError, true);
    assert.match(textContent(malformed), /JASON_REJECTED/);
  });

  void it('propagates cancellation and sanitizes cancelled CLI failures', async () => {
    await client.close();
    await server.close();

    const commands = new FakeJasonCommands();
    commands.waitForFormatAbort = true;
    const started = new Promise<void>((resolve) => {
      commands.onFormatStarted = resolve;
    });
    const cancelled = new Promise<void>((resolve) => {
      commands.onFormatCancelled = resolve;
    });
    server = createJasonMcpServer({ commands });
    client = new Client({ name: 'jason-mcp-test', version: '1.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const cancellation = new AbortController();
    const call = client.callTool(
      { name: 'format_json', arguments: { input: '{}' } },
      { signal: cancellation.signal },
    );
    await started;
    cancellation.abort();
    await assert.rejects(call, /AbortError/);
    await cancelled;
    assert.equal(commands.formatSignal?.aborted, true);

    commands.waitForFormatAbort = false;
    commands.format = () =>
      Promise.reject(
        new JasonCliError('ABORTED', 'secret cancellation detail'),
      );
    const failure = await client.callTool({
      name: 'format_json',
      arguments: { input: '{}' },
    });
    assert.equal(failure.isError, true);
    assert.match(textContent(failure), /CANCELLED/);
    assert.doesNotMatch(JSON.stringify(failure), /secret cancellation detail/);
  });
});

function textContent(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = result.content[0];
  return content?.type === 'text' ? content.text : '';
}
