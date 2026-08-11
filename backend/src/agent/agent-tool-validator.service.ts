import { Injectable } from '@nestjs/common';
import Ajv, { type ValidateFunction } from 'ajv';
import { AgentError } from './agent.errors';
import {
  AGENT_RUNTIME_LIMITS,
  AGENT_TOOL_DEFINITIONS,
  type AgentToolInputMap,
  type AgentToolName,
  type AgentToolResultMap,
} from './contracts/tool-contracts';

@Injectable()
export class AgentToolValidator {
  private readonly inputValidators: Record<AgentToolName, ValidateFunction>;
  private readonly resultValidators: Record<AgentToolName, ValidateFunction>;

  constructor() {
    const ajv = new Ajv({ allErrors: true, strict: true });

    this.inputValidators = compileValidators(ajv, 'inputSchema');
    this.resultValidators = compileValidators(ajv, 'resultSchema');
  }

  validateArguments<TTool extends AgentToolName>(
    tool: TTool,
    argumentsJson: string,
  ): AgentToolInputMap[TTool] {
    let value: unknown;

    try {
      value = JSON.parse(argumentsJson) as unknown;
    } catch {
      throw new AgentError(
        'INVALID_TOOL_ARGUMENTS',
        'The provider returned malformed tool arguments.',
      );
    }

    if (!this.inputValidators[tool](value)) {
      throw new AgentError(
        'INVALID_TOOL_ARGUMENTS',
        'The provider returned tool arguments that do not match the approved schema.',
      );
    }

    const contextBytes = Object.values(
      value as Record<string, unknown>,
    ).reduce<number>(
      (total, item) =>
        total +
        (typeof item === 'string' ? Buffer.byteLength(item, 'utf8') : 0),
      0,
    );

    if (contextBytes > AGENT_RUNTIME_LIMITS.untrustedContextBytes) {
      throw new AgentError(
        'INVALID_TOOL_ARGUMENTS',
        'The selected AI context exceeds the 16 KiB UTF-8 limit.',
      );
    }

    return value as AgentToolInputMap[TTool];
  }

  validateResult<TTool extends AgentToolName>(
    tool: TTool,
    result: AgentToolResultMap[TTool],
  ): void {
    if (!this.resultValidators[tool](result)) {
      throw new AgentError(
        'INVALID_TOOL_RESULT',
        'The deterministic tool returned an unexpected result shape.',
      );
    }
  }
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
