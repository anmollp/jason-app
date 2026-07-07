import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';

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

  private run(args: string[], input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = execFile(
        this.cliPath,
        args,
        {
          timeout: 5_000,
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            if ('code' in error && error.code === 'ENOENT') {
              reject(
                new Error(
                  `Jason CLI not found at "${this.cliPath}". Set JASON_CLI_PATH to the built Rust binary, or add jason to PATH.`,
                ),
              );
              return;
            }

            reject(new Error(stderr.trim() || error.message));
            return;
          }

          resolve(stdout.trimEnd());
        },
      );

      child.stdin?.end(input);
    });
  }
}
