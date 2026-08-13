import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export const JASON_CLI_TIMEOUT_MS = 5_000;

export type JasonCliErrorCode =
  | 'ABORTED'
  | 'BUSY'
  | 'CLI_NOT_FOUND'
  | 'OUTPUT_LIMIT'
  | 'RUST_REJECTED'
  | 'TIMEOUT';

export class JasonCliError extends Error {
  constructor(
    readonly code: JasonCliErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'JasonCliError';
  }
}

export type JasonCliRunnerOptions = {
  cliPath?: string;
  timeoutMs?: number;
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
  maxConcurrentRuns?: number;
  environment?: NodeJS.ProcessEnv;
};

export class JasonCliRunner {
  private readonly cliPath: string;
  private readonly timeoutMs: number;
  private readonly maxStdoutBytes?: number;
  private readonly maxStderrBytes?: number;
  private readonly maxConcurrentRuns?: number;
  private readonly environment: NodeJS.ProcessEnv;
  private activeRuns = 0;

  constructor(options: JasonCliRunnerOptions = {}) {
    this.cliPath = options.cliPath ?? process.env.JASON_CLI_PATH ?? 'jason';
    this.timeoutMs = options.timeoutMs ?? JASON_CLI_TIMEOUT_MS;
    this.maxStdoutBytes = options.maxStdoutBytes;
    this.maxStderrBytes = options.maxStderrBytes;
    this.maxConcurrentRuns = options.maxConcurrentRuns;
    this.environment = options.environment ?? process.env;
  }

  format(input: string, signal?: AbortSignal): Promise<string> {
    return this.run(['format', '--stdin'], input, signal);
  }

  diff(before: string, after: string, signal?: AbortSignal): Promise<string> {
    return this.run(['diff', '--stdin'], `${before}\0${after}`, signal);
  }

  patch(
    document: string,
    patch: string,
    signal?: AbortSignal,
  ): Promise<string> {
    return this.run(['patch', '--stdin'], `${document}\0${patch}`, signal);
  }

  pointer(
    document: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<string> {
    return this.run(['pointer', '--stdin'], `${document}\0${path}`, signal);
  }

  private run(
    args: readonly string[],
    input: string,
    signal?: AbortSignal,
  ): Promise<string> {
    if (
      this.maxConcurrentRuns !== undefined &&
      this.activeRuns >= this.maxConcurrentRuns
    ) {
      return Promise.reject(
        new JasonCliError(
          'BUSY',
          'The Jason CLI is already processing a call.',
        ),
      );
    }

    if (signal?.aborted) {
      return Promise.reject(
        new JasonCliError('ABORTED', 'The Jason CLI call was cancelled.'),
      );
    }

    this.activeRuns += 1;

    return new Promise((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(this.cliPath, args, {
          env: this.environment,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        this.activeRuns -= 1;
        reject(
          new JasonCliError('RUST_REJECTED', 'The Jason CLI could not start.'),
        );
        return;
      }
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let isSettled = false;
      let isReleased = false;
      let forceKill: NodeJS.Timeout | undefined;

      const terminate = () => {
        child.kill('SIGTERM');
        forceKill ??= setTimeout(() => child.kill('SIGKILL'), 250);
        forceKill.unref();
      };

      const timeout = setTimeout(() => {
        terminate();
        finish(new JasonCliError('TIMEOUT', 'The Jason CLI call timed out.'));
      }, this.timeoutMs);

      const abort = () => {
        terminate();
        finish(
          new JasonCliError('ABORTED', 'The Jason CLI call was cancelled.'),
        );
      };
      signal?.addEventListener('abort', abort, { once: true });

      const release = () => {
        if (!isReleased) {
          isReleased = true;
          this.activeRuns -= 1;
        }
        if (forceKill) {
          clearTimeout(forceKill);
        }
      };

      const finish = (error?: Error, output = '') => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);

        if (error) {
          reject(error);
          return;
        }

        resolve(output.trimEnd());
      };

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (
          this.maxStdoutBytes !== undefined &&
          stdoutBytes > this.maxStdoutBytes
        ) {
          terminate();
          finish(
            new JasonCliError(
              'OUTPUT_LIMIT',
              'The Jason CLI output exceeded its limit.',
            ),
          );
          return;
        }
        stdout.push(chunk);
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (
          this.maxStderrBytes !== undefined &&
          stderrBytes > this.maxStderrBytes
        ) {
          terminate();
          finish(
            new JasonCliError(
              'OUTPUT_LIMIT',
              'The Jason CLI error output exceeded its limit.',
            ),
          );
          return;
        }
        stderr.push(chunk);
      });

      child.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          finish(
            new JasonCliError(
              'CLI_NOT_FOUND',
              'The Jason CLI executable could not be found.',
            ),
          );
          return;
        }

        finish(
          new JasonCliError('RUST_REJECTED', 'The Jason CLI could not start.'),
        );
      });

      child.on('close', (code) => {
        release();
        if (isSettled) {
          return;
        }

        if (code !== 0) {
          const detail = Buffer.concat(stderr).toString('utf8').trim();
          finish(
            new JasonCliError(
              'RUST_REJECTED',
              detail || `The Jason CLI exited with code ${code}.`,
            ),
          );
          return;
        }

        finish(undefined, Buffer.concat(stdout).toString('utf8'));
      });

      child.stdin.on('error', () => {
        terminate();
        finish(
          new JasonCliError(
            'RUST_REJECTED',
            'The Jason CLI rejected its input.',
          ),
        );
      });
      child.stdin.end(input);
    });
  }
}

export function minimalJasonEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    ['PATH', 'PATHEXT', 'SystemRoot', 'WINDIR'].flatMap((key) =>
      environment[key] === undefined ? [] : [[key, environment[key]]],
    ),
  );
}
