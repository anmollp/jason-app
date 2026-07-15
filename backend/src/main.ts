import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile } from 'node:process';
import { AppModule } from './app.module';
import { configureBodyParser } from './body-parser.config';

async function bootstrap() {
  const localEnvPaths = [
    join(process.cwd(), '.env'),
    join(__dirname, '..', '.env'),
  ];
  const localEnvPath = localEnvPaths.find((path) => existsSync(path));

  if (localEnvPath) {
    loadEnvFile(localEnvPath);
  }

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureBodyParser(app);
  app.enableCors({
    origin: parseCorsOrigins(process.env.FRONTEND_ORIGIN),
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

function parseCorsOrigins(originConfig?: string): string | string[] {
  const origins = (originConfig ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return 'http://localhost:3001';
  }

  return origins.length === 1 ? origins[0] : origins;
}
