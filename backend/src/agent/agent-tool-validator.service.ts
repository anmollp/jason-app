import { Injectable } from '@nestjs/common';
import { AgentError } from './agent.errors';
import {
  type AgentToolInputMap,
  type AgentToolName,
  type AgentToolResultMap,
} from './contracts/tool-contracts';
import {
  ToolContractValidationError,
  ToolContractValidator,
} from '../tool-contract-validator';

@Injectable()
export class AgentToolValidator {
  private readonly contracts = new ToolContractValidator();

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

    try {
      return this.contracts.validateInput(tool, value);
    } catch (error) {
      if (!(error instanceof ToolContractValidationError)) {
        throw error;
      }
      if (error.code === 'CONTEXT_LIMIT') {
        throw new AgentError(
          'INVALID_TOOL_ARGUMENTS',
          'The selected AI context exceeds the 16 KiB UTF-8 limit.',
        );
      }
      throw new AgentError(
        'INVALID_TOOL_ARGUMENTS',
        'The provider returned tool arguments that do not match the approved schema.',
      );
    }
  }

  validateResult<TTool extends AgentToolName>(
    tool: TTool,
    result: AgentToolResultMap[TTool],
  ): void {
    try {
      this.contracts.validateResult(tool, result);
    } catch (error) {
      if (!(error instanceof ToolContractValidationError)) {
        throw error;
      }
      throw new AgentError(
        'INVALID_TOOL_RESULT',
        'The deterministic tool returned an unexpected result shape.',
      );
    }
  }
}
