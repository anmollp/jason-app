import {
  Body,
  Controller,
  Headers,
  HttpException,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AgentError, normalizePublicError } from './agent.errors';
import { AgentSessionService } from './agent-session.service';
import { parseAgentMessageRequest } from './contracts/http-contracts';

@Controller('api/agent')
export class AgentController {
  constructor(private readonly sessions: AgentSessionService) {}

  @Post('session')
  async issueSession(
    @Headers('cookie') cookieHeader: string | undefined,
    @Headers('x-askjason-client-ip') clientIp: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!clientIp) {
      throw new HttpException('A trusted client identity is required.', 400);
    }

    try {
      const issued = await this.sessions.issueSession(cookieHeader, clientIp);
      if (issued.setCookie) {
        response.setHeader('Set-Cookie', issued.setCookie);
      }
      response.setHeader('Cache-Control', 'no-store');
      return issued.response;
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Post('message')
  async message(
    @Body() body: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    const disconnect = new AbortController();
    request.once('aborted', () => disconnect.abort());
    response.once('close', () => {
      if (!response.writableEnded) {
        disconnect.abort();
      }
    });

    try {
      const parsed = parseAgentMessageRequest(body);
      for await (const event of this.sessions.streamMessage(
        parsed,
        disconnect.signal,
      )) {
        response.write(serializeSse(event.type, event));
      }
    } catch (error) {
      const publicError = normalizePublicError(error);
      response.write(serializeSse('error', publicError));
      response.write(serializeSse('done', { type: 'done' }));
    } finally {
      response.end();
    }
  }
}

function serializeSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function toHttpException(error: unknown): HttpException {
  if (!(error instanceof AgentError)) {
    return new HttpException('The AI copilot is temporarily unavailable.', 503);
  }
  const status =
    error.code === 'INVALID_IDENTITY' || error.code === 'INVALID_REQUEST'
      ? 400
      : error.code === 'QUOTA_EXHAUSTED' || error.code === 'BUDGET_EXHAUSTED'
        ? 429
        : error.code === 'FEATURE_DISABLED'
          ? 503
          : 503;
  return new HttpException(error.message, status);
}
