import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';

@Injectable()
export class JasonCliService {
  private readonly cliPath = process.env.JASON_CLI_PATH ?? 'jason';

  format(input: string): Promise<string> {
    return this.run(['format', '--stdin'], input);
  }

  diff(before: string, after: string): Promise<string> {
    return this.run(['diff', '--stdin'], `${before}\0${after}`);
  }

  patch(document: string, patch: string): Promise<string> {
    return this.run(['patch', '--stdin'], `${document}\0${patch}`);
  }

  pointer(document: string, path: string): Promise<string> {
    return this.run(['pointer', '--stdin'], `${document}\0${path}`);
  }

  private run(args: string[], input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.cliPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let isSettled = false;
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        finish(new Error('Jason CLI timed out.'));
      }, 5_000);

      function finish(error?: Error, output = '') {
        if (isSettled) {
          return;
        }

        isSettled = true;
        clearTimeout(timeout);

        if (error) {
          reject(error);
          return;
        }

        resolve(output.trimEnd());
      }

      child.stdout.on('data', (chunk: Buffer) => {
        stdout.push(chunk);
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr.push(chunk);
      });

      child.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          finish(
            new Error(
              `Jason CLI not found at "${this.cliPath}". Set JASON_CLI_PATH to the built Rust binary, or add jason to PATH.`,
            ),
          );
          return;
        }

        finish(error);
      });

      child.on('close', (code) => {
        if (isSettled) {
          return;
        }

        const stderrOutput = Buffer.concat(stderr).toString('utf8').trim();

        if (code !== 0) {
          finish(
            new Error(stderrOutput || `Jason CLI exited with code ${code}.`),
          );
          return;
        }

        finish(undefined, Buffer.concat(stdout).toString('utf8'));
      });

      child.stdin?.end(input);
    });
  }
}
