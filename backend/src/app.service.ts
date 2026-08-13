import { Injectable } from '@nestjs/common';
import { JasonCliService } from './jason-cli.service';
import { JsonToolExecutor } from './json-tool.executor';
import type {
  DiffJsonResponse,
  FormatJsonResponse,
  HealthResponse,
  PatchJsonResponse,
  PointerJsonResponse,
} from './json-tools.types';

export type {
  DiffJsonRequest,
  DiffJsonResponse,
  DiffJsonSummary,
  FormatJsonRequest,
  FormatJsonResponse,
  HealthResponse,
  JsonPatchOperation,
  PatchJsonRequest,
  PatchJsonResponse,
  PatchJsonSummary,
  PointerJsonRequest,
  PointerJsonResponse,
  PointerJsonSummary,
} from './json-tools.types';

@Injectable()
export class AppService {
  private readonly tools: JsonToolExecutor;

  constructor(jasonCliService: JasonCliService) {
    this.tools = new JsonToolExecutor(jasonCliService);
  }

  getHealth(): HealthResponse {
    return {
      name: 'jason-api',
      status: 'ok',
      version: process.env.npm_package_version ?? '0.0.1',
    };
  }

  async formatJson(input: string): Promise<FormatJsonResponse> {
    return this.tools.formatJson(input);
  }

  async diffJson(before: string, after: string): Promise<DiffJsonResponse> {
    return this.tools.diffJson(before, after);
  }

  async patchJson(document: string, patch: string): Promise<PatchJsonResponse> {
    return this.tools.patchJson(document, patch);
  }

  async pointerJson(
    document: string,
    path: string,
  ): Promise<PointerJsonResponse> {
    return this.tools.pointerJson(document, path);
  }
}
