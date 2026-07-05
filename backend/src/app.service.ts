import { Injectable } from '@nestjs/common';
import { JasonCliService } from './jason-cli.service';

export type FormatJsonRequest = {
  input: string;
};

export type FormatJsonResponse = {
  output: string;
};

@Injectable()
export class AppService {
  constructor(private readonly jasonCliService: JasonCliService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async formatJson(input: string): Promise<FormatJsonResponse> {
    return {
      output: await this.jasonCliService.format(input),
    };
  }
}
