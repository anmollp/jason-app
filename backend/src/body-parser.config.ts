import type { INestApplication } from '@nestjs/common';
import {
  json,
  urlencoded,
  type NextFunction,
  type Request,
  type Response,
} from 'express';

export const jsonPayloadLimit = '12mb';
export const agentJsonPayloadLimit = '32kb';

export function configureBodyParser(app: INestApplication) {
  app.use('/api/agent', json({ limit: agentJsonPayloadLimit }));
  app.use(json({ limit: jsonPayloadLimit }));
  app.use(urlencoded({ extended: true, limit: jsonPayloadLimit }));
  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      next: NextFunction,
    ) => {
      if (isPayloadTooLarge(error)) {
        response.status(413).json({
          code: 'PAYLOAD_TOO_LARGE',
          message: 'The request body is too large.',
        });
        return;
      }
      next(error);
    },
  );
}

function isPayloadTooLarge(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { type?: unknown }).type === 'entity.too.large'
  );
}
