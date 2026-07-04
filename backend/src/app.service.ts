import { Injectable } from '@nestjs/common';

export type FormatJsonRequest = {
  input: string;
};

export type FormatJsonResponse = {
  output: string;
};

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  formatJson(input: string): FormatJsonResponse {
    const parsed = JSON.parse(input) as unknown;

    return {
      output: JSON.stringify(parsed, null, 2),
    };
  }
}
