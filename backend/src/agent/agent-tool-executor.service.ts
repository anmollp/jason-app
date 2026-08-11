import { Injectable } from '@nestjs/common';
import { AppService } from '../app.service';
import type {
  NormalizedToolErrorCode,
  NormalizedToolResult,
  ProviderToolCall,
} from './contracts/provider-contracts';
import type {
  AgentToolInputMap,
  AgentToolName,
  AgentToolResultMap,
} from './contracts/tool-contracts';
import { AgentToolValidator } from './agent-tool-validator.service';

@Injectable()
export class AgentToolExecutor {
  constructor(
    private readonly appService: AppService,
    private readonly validator: AgentToolValidator,
  ) {}

  async execute(call: ProviderToolCall): Promise<NormalizedToolResult> {
    const args = this.validator.validateArguments(
      call.tool,
      call.argumentsJson,
    );

    let data: AgentToolResultMap[typeof call.tool];

    try {
      data = await this.run(call.tool, args);
    } catch (error) {
      const code = classifyToolFailure(error);

      return {
        ok: false,
        tool: call.tool,
        callId: call.callId,
        error: {
          code,
          message: safeToolFailureMessage(code),
        },
      };
    }

    this.validator.validateResult(call.tool, data);

    return {
      ok: true,
      tool: call.tool,
      callId: call.callId,
      data,
      validation: { engine: 'jason', valid: true },
    };
  }

  private run<TTool extends AgentToolName>(
    tool: TTool,
    args: AgentToolInputMap[TTool],
  ): Promise<AgentToolResultMap[TTool]> {
    switch (tool) {
      case 'format_json': {
        const input = args as AgentToolInputMap['format_json'];
        return this.appService.formatJson(input.input) as Promise<
          AgentToolResultMap[TTool]
        >;
      }
      case 'diff_json': {
        const input = args as AgentToolInputMap['diff_json'];
        return this.appService.diffJson(input.before, input.after) as Promise<
          AgentToolResultMap[TTool]
        >;
      }
      case 'apply_json_patch': {
        const input = args as AgentToolInputMap['apply_json_patch'];
        return this.appService.patchJson(
          input.document,
          input.patch,
        ) as Promise<AgentToolResultMap[TTool]>;
      }
      case 'resolve_json_pointer': {
        const input = args as AgentToolInputMap['resolve_json_pointer'];
        return this.appService.pointerJson(
          input.document,
          input.path,
        ) as Promise<AgentToolResultMap[TTool]>;
      }
    }
  }
}

function classifyToolFailure(error: unknown): NormalizedToolErrorCode {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('timed out')) {
    return 'TIMEOUT';
  }

  if (
    message.includes('json') ||
    message.includes('parse') ||
    message.includes('expected')
  ) {
    return 'INVALID_JSON';
  }

  return 'RUST_REJECTED';
}

function safeToolFailureMessage(code: NormalizedToolErrorCode): string {
  switch (code) {
    case 'TIMEOUT':
      return 'The deterministic Jason tool timed out.';
    case 'INVALID_JSON':
      return 'The deterministic Jason tool rejected invalid JSON input.';
    case 'INVALID_ARGUMENTS':
      return 'The tool arguments were invalid.';
    case 'RUST_REJECTED':
      return 'The deterministic Jason tool could not complete this request.';
  }
}
