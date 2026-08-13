import { Injectable } from '@nestjs/common';
import { JasonCliRunner } from './jason-cli.runner';

@Injectable()
export class JasonCliService {
  private readonly runner = new JasonCliRunner();

  format(input: string): Promise<string> {
    return this.runner.format(input);
  }

  diff(before: string, after: string): Promise<string> {
    return this.runner.diff(before, after);
  }

  patch(document: string, patch: string): Promise<string> {
    return this.runner.patch(document, patch);
  }

  pointer(document: string, path: string): Promise<string> {
    return this.runner.pointer(document, path);
  }
}
