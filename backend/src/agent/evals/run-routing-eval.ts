import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { AppService } from '../../app.service';
import { JasonCliService } from '../../jason-cli.service';
import { AgentToolExecutor } from '../agent-tool-executor.service';
import { AgentToolValidator } from '../agent-tool-validator.service';
import { AgentTurnOrchestrator } from '../agent-turn-orchestrator.service';
import {
  createOpenAiResponsesClient,
  OpenAiResponsesProvider,
} from '../providers/openai-responses.provider';
import type { ProviderToolCall } from '../contracts/provider-contracts';
import { RoutingEvalRunner } from './routing-eval-runner';
import type { RoutingEvalModel } from './routing-eval';
import {
  createPrivateEvalReport,
  finalizeEvalReport,
  parseEvalJudgments,
  readPrivateEvalReport,
  reserveJsonReport,
  writeJsonAtomically,
} from './routing-eval-report';
import { ROUTING_FIXTURES } from './routing-fixtures';
import { isSystemicProviderError } from './routing-eval-policy';

async function main(): Promise<void> {
  const mode = process.env.AI_EVAL_MODE;
  if (mode === 'run') {
    await runPaidEval();
    return;
  }
  if (mode === 'finalize') {
    await finalizeExistingEval();
    return;
  }
  throw new EvalCliError(
    'INVALID_MODE',
    'AI_EVAL_MODE must be run or finalize.',
  );
}

async function runPaidEval(): Promise<void> {
  if (process.env.AI_EVAL_CONFIRM_PAID !== 'true') {
    throw new EvalCliError(
      'PAID_CONFIRMATION_REQUIRED',
      'AI_EVAL_CONFIRM_PAID=true is required for a paid run.',
    );
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new EvalCliError(
      'API_KEY_REQUIRED',
      'OPENAI_API_KEY is required for a paid run.',
    );
  }
  const reportPath = requireAbsolutePath(
    'AI_EVAL_REPORT_PATH',
    process.env.AI_EVAL_REPORT_PATH,
  );
  const model = readModel(process.env.AI_EVAL_MODEL);
  const reportReservation = await reserveReport(reportPath);
  const executor = new AgentToolExecutor(
    new AppService(new JasonCliService()),
    new AgentToolValidator(),
  );

  await preflightJason(executor);
  const provider = new OpenAiResponsesProvider(
    createOpenAiResponsesClient(apiKey),
    { model, maxOutputTokens: 700 },
  );
  const result = await new RoutingEvalRunner(
    provider,
    new AgentTurnOrchestrator(executor),
    model,
  ).run(ROUTING_FIXTURES, {
    turnsPerSession: 3,
    stopOnError: isSystemicProviderError,
  });
  const report = createPrivateEvalReport(result, model, {
    turnsPerSession: 3,
  });
  await writeReservedReport(reportReservation, report);
  writeStatus('PRIVATE_REPORT_WRITTEN', {
    path: reportPath,
    cases: report.cases.length,
    reviewHashes: report.cases.map((item) => ({
      id: item.id,
      reviewHash: item.reviewHash,
    })),
  });

  const automaticPass =
    report.cases.length === 60 &&
    report.sessions.length === 20 &&
    report.fatalError === undefined &&
    Object.values(report.summary.thresholds).every(Boolean) &&
    (model !== 'gpt-5.6-luna' ||
      report.sessionCost.belowThirtyMilliUsd === true);
  if (!automaticPass) {
    process.exitCode = 1;
  }
}

async function finalizeExistingEval(): Promise<void> {
  const reportPath = requireAbsolutePath(
    'AI_EVAL_REPORT_PATH',
    process.env.AI_EVAL_REPORT_PATH,
  );
  const judgmentsPath = requireAbsolutePath(
    'AI_EVAL_JUDGMENTS_PATH',
    process.env.AI_EVAL_JUDGMENTS_PATH,
  );
  const finalPath = requireAbsolutePath(
    'AI_EVAL_FINAL_REPORT_PATH',
    process.env.AI_EVAL_FINAL_REPORT_PATH,
  );
  if (finalPath === reportPath) {
    throw new EvalCliError(
      'INVALID_REPORT_PATH',
      'The final report path must differ from the private report path.',
    );
  }

  const report = await readReport(reportPath);
  const judgmentValue = await readJson(judgmentsPath, 'INVALID_JUDGMENTS');
  let finalized: ReturnType<typeof finalizeEvalReport>;
  try {
    const judgments = parseEvalJudgments(
      judgmentValue,
      report.cases.map((item) => item.id),
    );
    finalized = finalizeEvalReport(report, judgments);
  } catch {
    throw new EvalCliError(
      'INVALID_JUDGMENTS',
      'The judgments are invalid or do not match this private report.',
    );
  }
  await writeReport(finalPath, finalized);
  writeStatus('FINAL_REPORT_WRITTEN', {
    path: finalPath,
    ready: finalized.ready,
    pending: finalized.semanticReview.pending,
    failed: finalized.semanticReview.failed,
  });
  if (!finalized.ready) {
    process.exitCode = 1;
  }
}

async function preflightJason(executor: AgentToolExecutor): Promise<void> {
  const calls: ProviderToolCall[] = [
    toolCall('format_json', { input: '{}' }),
    toolCall('diff_json', { before: '{}', after: '{"ready":true}' }),
    toolCall('apply_json_patch', {
      document: '{"ready":false}',
      patch: '[{"op":"replace","path":"/ready","value":true}]',
    }),
    toolCall('resolve_json_pointer', {
      document: '{"ready":true}',
      path: '/ready',
    }),
  ];
  try {
    for (const call of calls) {
      const result = await executor.execute(call);
      if (!result.ok) {
        throw new Error('Jason preflight tool failed.');
      }
    }
  } catch {
    throw new EvalCliError(
      'JASON_PREFLIGHT_FAILED',
      'The local Jason CLI preflight failed; no model calls were made.',
    );
  }
}

function toolCall(
  tool: ProviderToolCall['tool'],
  input: Record<string, string>,
): ProviderToolCall {
  return {
    callId: `preflight-${tool}`,
    tool,
    argumentsJson: JSON.stringify(input),
  };
}

function readModel(value: string | undefined): RoutingEvalModel {
  if (value === undefined || value === 'gpt-5.6-luna') {
    return 'gpt-5.6-luna';
  }
  if (value === 'gpt-5.6-terra') {
    return value;
  }
  throw new EvalCliError(
    'INVALID_MODEL',
    'AI_EVAL_MODEL must be gpt-5.6-luna or gpt-5.6-terra.',
  );
}

function requireAbsolutePath(name: string, value: string | undefined): string {
  if (!value || !isAbsolute(value)) {
    throw new EvalCliError(
      'INVALID_REPORT_PATH',
      `${name} must be an absolute path.`,
    );
  }
  return value;
}

async function readReport(path: string) {
  try {
    return await readPrivateEvalReport(path);
  } catch {
    throw new EvalCliError(
      'INVALID_PRIVATE_REPORT',
      'The private eval report is missing, invalid, or incompatible.',
    );
  }
}

async function readJson(path: string, code: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    throw new EvalCliError(code, 'The requested JSON file is invalid.');
  }
}

async function writeReport(path: string, value: unknown): Promise<void> {
  try {
    await writeJsonAtomically(path, value);
  } catch {
    throw new EvalCliError(
      'REPORT_WRITE_FAILED',
      'The report path already exists or could not be written safely.',
    );
  }
}

async function reserveReport(path: string) {
  try {
    return await reserveJsonReport(path);
  } catch {
    throw new EvalCliError(
      'REPORT_WRITE_FAILED',
      'The report path already exists or could not be reserved safely.',
    );
  }
}

async function writeReservedReport(
  reservation: Awaited<ReturnType<typeof reserveJsonReport>>,
  value: unknown,
): Promise<void> {
  try {
    await reservation.write(value);
  } catch {
    throw new EvalCliError(
      'REPORT_WRITE_FAILED',
      'The reserved report could not be written safely.',
    );
  }
}

function writeStatus(code: string, detail: unknown): void {
  process.stderr.write(`${JSON.stringify({ code, detail })}\n`);
}

class EvalCliError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EvalCliError';
  }
}

void main().catch((error: unknown) => {
  const safe =
    error instanceof EvalCliError
      ? error
      : new EvalCliError(
          'EVAL_FAILED',
          'The routing eval could not complete safely.',
        );
  process.stderr.write(`[${safe.code}] ${safe.message}\n`);
  process.exitCode = 1;
});
