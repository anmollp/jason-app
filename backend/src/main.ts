import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile } from 'node:process';
import { AppModule } from './app.module';

async function bootstrap() {
  const localEnvPaths = [
    join(process.cwd(), '.env'),
    join(__dirname, '..', '.env'),
  ];
  const localEnvPath = localEnvPaths.find((path) => existsSync(path));

  if (localEnvPath) {
    loadEnvFile(localEnvPath);
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3001',
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
