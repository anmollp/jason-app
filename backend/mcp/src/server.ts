import {
  fromJsonSchema,
  McpServer,
  type CallToolResult,
  type JsonSchemaType,
} from '@modelcontextprotocol/server';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/server/validators/ajv';
import {
  AGENT_TOOL_DEFINITIONS,
  type AgentToolInputMap,
  type AgentToolName,
  type AgentToolResultMap,
} from '../../src/agent/contracts/tool-contracts.js';
import {
  JasonCliError,
  JasonCliRunner,
  minimalJasonEnvironment,
} from '../../src/jason-cli.runner.js';
import {
  JsonToolExecutor,
  type JasonJsonCommands,
} from '../../src/json-tool.executor.js';
import {
  ToolContractValidationError,
  ToolContractValidator,
} from '../../src/tool-contract-validator.js';

export const MCP_SERVER_NAME = 'jason-mcp';
export const MCP_SERVER_VERSION = '0.1.0';
export const MCP_MAX_PROTOCOL_BYTES = 1024 * 1024;
export const MCP_MAX_STDOUT_BYTES = 1024 * 1024;
export const MCP_MAX_STDERR_BYTES = 64 * 1024;

type McpServerOptions = {
  commands?: JasonJsonCommands;
};

export function createJasonMcpServer(
  options: McpServerOptions = {},
): McpServer {
  const commands =
    options.commands ??
    new JasonCliRunner({
      environment: minimalJasonEnvironment(),
      maxConcurrentRuns: 1,
      maxStderrBytes: MCP_MAX_STDERR_BYTES,
      maxStdoutBytes: MCP_MAX_STDOUT_BYTES,
    });
  const executor = new JsonToolExecutor(commands);
  const contracts = new ToolContractValidator();
  const schemaValidator = new AjvJsonSchemaValidator();
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });

  for (const definition of AGENT_TOOL_DEFINITIONS) {
    const tool = definition.name;
    server.registerTool(
      tool,
      {
        description: definition.description,
        inputSchema: fromJsonSchema<Record<string, unknown>>(
          definition.inputSchema as JsonSchemaType,
          schemaValidator,
        ),
        outputSchema: fromJsonSchema<Record<string, unknown>>(
          definition.resultSchema as JsonSchemaType,
          schemaValidator,
        ),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (input, context) =>
        executeTool(tool, input, context.mcpReq.signal, contracts, executor),
    );
  }

  return server;
}

async function executeTool<TTool extends AgentToolName>(
  tool: TTool,
  input: unknown,
  signal: AbortSignal,
  contracts: ToolContractValidator,
  executor: JsonToolExecutor,
): Promise<CallToolResult> {
  try {
    const args = contracts.validateInput(tool, input);
    const result = await runTool(executor, tool, args, signal);
    const validated = contracts.validateResult(tool, result);

    return {
      content: [{ type: 'text', text: JSON.stringify(validated) }],
      structuredContent: validated,
    };
  } catch (error) {
    const safe = normalizeToolError(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: safe }) }],
      isError: true,
    };
  }
}

function runTool<TTool extends AgentToolName>(
  executor: JsonToolExecutor,
  tool: TTool,
  args: AgentToolInputMap[TTool],
  signal: AbortSignal,
): Promise<AgentToolResultMap[TTool]> {
  switch (tool) {
    case 'format_json': {
      const input = args as AgentToolInputMap['format_json'];
      return executor.formatJson(input.input, signal) as Promise<
        AgentToolResultMap[TTool]
      >;
    }
    case 'diff_json': {
      const input = args as AgentToolInputMap['diff_json'];
      return executor.diffJson(input.before, input.after, signal) as Promise<
        AgentToolResultMap[TTool]
      >;
    }
    case 'apply_json_patch': {
      const input = args as AgentToolInputMap['apply_json_patch'];
      return executor.patchJson(input.document, input.patch, signal) as Promise<
        AgentToolResultMap[TTool]
      >;
    }
    case 'resolve_json_pointer': {
      const input = args as AgentToolInputMap['resolve_json_pointer'];
      return executor.pointerJson(
        input.document,
        input.path,
        signal,
      ) as Promise<AgentToolResultMap[TTool]>;
    }
  }
}

type SafeToolError = {
  code: string;
  message: string;
};

function normalizeToolError(error: unknown): SafeToolError {
  if (error instanceof ToolContractValidationError) {
    return error.code !== 'INVALID_RESULT'
      ? { code: 'INVALID_INPUT', message: 'The tool input is invalid.' }
      : {
          code: 'JASON_REJECTED',
          message: 'Jason returned an invalid result.',
        };
  }

  if (error instanceof JasonCliError) {
    switch (error.code) {
      case 'ABORTED':
        return { code: 'CANCELLED', message: 'The tool call was cancelled.' };
      case 'BUSY':
        return { code: 'BUSY', message: 'Jason is processing another call.' };
      case 'CLI_NOT_FOUND':
        return {
          code: 'CLI_NOT_FOUND',
          message: 'The local Jason CLI could not be found.',
        };
      case 'OUTPUT_LIMIT':
        return {
          code: 'OUTPUT_LIMIT',
          message: 'Jason exceeded the local output limit.',
        };
      case 'TIMEOUT':
        return { code: 'TIMEOUT', message: 'The Jason CLI timed out.' };
      case 'RUST_REJECTED':
        break;
    }
  }

  return {
    code: 'JASON_REJECTED',
    message: 'Jason could not complete the tool call.',
  };
}
