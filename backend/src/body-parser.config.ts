import type { INestApplication } from '@nestjs/common';
import { json, urlencoded } from 'express';

export const jsonPayloadLimit = '12mb';

export function configureBodyParser(app: INestApplication) {
  app.use(json({ limit: jsonPayloadLimit }));
  app.use(urlencoded({ extended: true, limit: jsonPayloadLimit }));
}
