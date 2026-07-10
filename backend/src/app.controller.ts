import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import { AppService } from './app.service';
import type {
  DiffJsonRequest,
  DiffJsonResponse,
  FormatJsonRequest,
  FormatJsonResponse,
  HealthResponse,
  PatchJsonRequest,
  PatchJsonResponse,
  PointerJsonRequest,
  PointerJsonResponse,
} from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(): HealthResponse {
    return this.appService.getHealth();
  }

  @Get('health')
  getHealth(): HealthResponse {
    return this.appService.getHealth();
  }

  @Post('format')
  @HttpCode(200)
  async formatJson(
    @Body() body: FormatJsonRequest,
  ): Promise<FormatJsonResponse> {
    if (typeof body?.input !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_REQUEST',
        message: 'Request body must include an input string.',
      });
    }

    try {
      return await this.appService.formatJson(body.input);
    } catch (error) {
      throw new BadRequestException({
        code: 'INVALID_JSON',
        message: "Jason couldn't parse this JSON.",
        detail:
          error instanceof Error
            ? error.message
            : 'The provided input is not valid JSON.',
      });
    }
  }

  @Post('diff')
  @HttpCode(200)
  async diffJson(@Body() body: DiffJsonRequest): Promise<DiffJsonResponse> {
    if (typeof body?.before !== 'string' || typeof body?.after !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_REQUEST',
        message: 'Request body must include before and after strings.',
      });
    }

    try {
      return await this.appService.diffJson(body.before, body.after);
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'One of the provided inputs is not valid JSON.';

      throw new BadRequestException({
        code: 'INVALID_JSON',
        message: "Jason couldn't compare these documents.",
        detail,
        field: parseDiffErrorField(detail),
      });
    }
  }

  @Post('patch')
  @HttpCode(200)
  async patchJson(@Body() body: PatchJsonRequest): Promise<PatchJsonResponse> {
    if (typeof body?.document !== 'string' || typeof body?.patch !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_REQUEST',
        message: 'Request body must include document and patch strings.',
      });
    }

    try {
      return await this.appService.patchJson(body.document, body.patch);
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'The document or patch input is not valid JSON.';

      throw new BadRequestException({
        code: 'INVALID_JSON',
        message: "Jason couldn't apply this patch.",
        detail,
        field: parsePatchErrorField(detail),
      });
    }
  }

  @Post('pointer')
  @HttpCode(200)
  async pointerJson(
    @Body() body: PointerJsonRequest,
  ): Promise<PointerJsonResponse> {
    if (typeof body?.document !== 'string' || typeof body?.path !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_REQUEST',
        message: 'Request body must include document and path strings.',
      });
    }

    try {
      return await this.appService.pointerJson(body.document, body.path);
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'The document or pointer path is not valid.';

      throw new BadRequestException({
        code: 'INVALID_JSON',
        message: "Jason couldn't resolve this pointer.",
        detail,
        field: parsePointerErrorField(detail),
      });
    }
  }
}

function parseDiffErrorField(message: string): 'before' | 'after' | undefined {
  if (message.startsWith('before:')) {
    return 'before';
  }

  if (message.startsWith('after:')) {
    return 'after';
  }

  return undefined;
}

function parsePatchErrorField(
  message: string,
): 'document' | 'patch' | undefined {
  if (message.startsWith('document:')) {
    return 'document';
  }

  if (
    message.startsWith('patch:') ||
    message.includes('JSON Patch operation') ||
    message.includes('patch operations')
  ) {
    return 'patch';
  }

  return undefined;
}

function parsePointerErrorField(
  message: string,
): 'document' | 'path' | undefined {
  if (message.startsWith('document:')) {
    return 'document';
  }

  if (message.startsWith('pointer:')) {
    return 'path';
  }

  return undefined;
}
