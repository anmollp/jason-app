import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import { AppService } from './app.service';
import type { FormatJsonRequest, FormatJsonResponse } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
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
}
