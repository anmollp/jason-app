import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

describe('routing eval command', () => {
  it('requires explicit paid-run confirmation', () => {
    const result = runCommand({ AI_EVAL_MODE: 'run' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('[PAID_CONFIRMATION_REQUIRED]');
  });

  it('preflights Jason before constructing a paid provider', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'askjason-eval-cli-'));
    const result = runCommand({
      AI_EVAL_MODE: 'run',
      AI_EVAL_CONFIRM_PAID: 'true',
      AI_EVAL_REPORT_PATH: resolve(directory, 'preflight.json'),
      JASON_CLI_PATH: '/definitely/missing/jason',
      OPENAI_API_KEY: 'not-a-real-key',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('[JASON_PREFLIGHT_FAILED]');
    expect(result.stderr).toContain('no model calls were made');
    expect(result.stderr).not.toContain('not-a-real-key');
  });

  it('reserves the report path before Jason or provider work', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'askjason-eval-cli-'));
    const reportPath = resolve(directory, 'existing.json');
    writeFileSync(reportPath, 'existing evidence');
    const result = runCommand({
      AI_EVAL_MODE: 'run',
      AI_EVAL_CONFIRM_PAID: 'true',
      AI_EVAL_REPORT_PATH: reportPath,
      JASON_CLI_PATH: '/definitely/missing/jason',
      OPENAI_API_KEY: 'not-a-real-key',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('[REPORT_WRITE_FAILED]');
    expect(result.stderr).not.toContain('[JASON_PREFLIGHT_FAILED]');
    expect(result.stderr).not.toContain('not-a-real-key');
  });
});

function runCommand(environment: NodeJS.ProcessEnv) {
  return spawnSync(
    process.execPath,
    ['-r', 'ts-node/register', resolve(__dirname, 'run-routing-eval.ts')],
    {
      cwd: resolve(__dirname, '../../..'),
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        NODE_PATH: process.env.NODE_PATH,
        ...environment,
      },
      timeout: 15_000,
    },
  );
}
