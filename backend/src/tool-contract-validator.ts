import Ajv, { type ValidateFunction } from 'ajv';
import {
  AGENT_RUNTIME_LIMITS,
  AGENT_TOOL_DEFINITIONS,
  type AgentToolInputMap,
  type AgentToolName,
  type AgentToolResultMap,
} from './agent/contracts/tool-contracts';

export type ToolContractValidationCode =
  | 'CONTEXT_LIMIT'
  | 'INVALID_ARGUMENTS'
  | 'INVALID_RESULT';

export class ToolContractValidationError extends Error {
  constructor(readonly code: ToolContractValidationCode) {
    super(
      code === 'INVALID_RESULT'
        ? 'Invalid tool result.'
        : 'Invalid tool arguments.',
    );
    this.name = 'ToolContractValidationError';
  }
}

export class ToolContractValidator {
  private readonly inputValidators: Record<AgentToolName, ValidateFunction>;
  private readonly resultValidators: Record<AgentToolName, ValidateFunction>;

  constructor() {
    const ajv = new Ajv({ allErrors: true, strict: true });
    this.inputValidators = compileValidators(ajv, 'inputSchema');
    this.resultValidators = compileValidators(ajv, 'resultSchema');
  }

  validateInput<TTool extends AgentToolName>(
    tool: TTool,
    value: unknown,
  ): AgentToolInputMap[TTool] {
    if (!this.inputValidators[tool](value)) {
      throw new ToolContractValidationError('INVALID_ARGUMENTS');
    }
    if (toolInputBytes(value) > AGENT_RUNTIME_LIMITS.untrustedContextBytes) {
      throw new ToolContractValidationError('CONTEXT_LIMIT');
    }

    return value as AgentToolInputMap[TTool];
  }

  validateResult<TTool extends AgentToolName>(
    tool: TTool,
    value: unknown,
  ): AgentToolResultMap[TTool] {
    if (!this.resultValidators[tool](value)) {
      throw new ToolContractValidationError('INVALID_RESULT');
    }

    return value as AgentToolResultMap[TTool];
  }
}

export function toolInputBytes(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 0;
  }

  return Object.values(value as Record<string, unknown>).reduce<number>(
    (total, item) =>
      total + (typeof item === 'string' ? Buffer.byteLength(item, 'utf8') : 0),
    0,
  );
}

function compileValidators(
  ajv: Ajv,
  schemaKey: 'inputSchema' | 'resultSchema',
): Record<AgentToolName, ValidateFunction> {
  return Object.fromEntries(
    AGENT_TOOL_DEFINITIONS.map((tool) => [
      tool.name,
      ajv.compile(tool[schemaKey]),
    ]),
  ) as Record<AgentToolName, ValidateFunction>;
}
