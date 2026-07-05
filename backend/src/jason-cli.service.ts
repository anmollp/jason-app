import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';

@Injectable()
export class JasonCliService {
  private readonly cliPath = process.env.JASON_CLI_PATH ?? 'jason';

  format(input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = execFile(
        this.cliPath,
        ['format', '--stdin'],
        {
          timeout: 5_000,
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
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
