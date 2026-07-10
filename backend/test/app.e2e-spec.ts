import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JasonCliService } from './../src/jason-cli.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const jasonCliService = {
    format: jest.fn((input: string) => {
      const parsed = JSON.parse(input) as unknown;

      return Promise.resolve(JSON.stringify(parsed, null, 2));
    }),
  };

  beforeEach(async () => {
    jasonCliService.format.mockClear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(JasonCliService)
      .useValue(jasonCliService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect({
      name: 'jason-api',
      status: 'ok',
      version: '0.0.1',
    });
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({
      name: 'jason-api',
      status: 'ok',
      version: '0.0.1',
    });
  });

  it('/format (POST) formats valid JSON', () => {
    return request(app.getHttpServer())
      .post('/format')
      .send({ input: '{"service":"billing","retry":true}' })
      .expect(200)
      .expect({
        output: '{\n  "service": "billing",\n  "retry": true\n}',
      });
  });

  it('/format (POST) rejects invalid JSON', () => {
    return request(app.getHttpServer())
      .post('/format')
      .send({ input: '{ "service": "billing", retry: true }' })
      .expect(400)
      .expect(({ body }) => {
        const responseBody = body as { detail?: unknown };

        expect(body).toMatchObject({
          code: 'INVALID_JSON',
          message: "Jason couldn't parse this JSON.",
        });
        expect(responseBody.detail).toEqual(expect.any(String));
      });
  });

  it('/format (POST) requires an input string', () => {
    return request(app.getHttpServer())
      .post('/format')
      .send({ input: 42 })
      .expect(400)
      .expect({
        code: 'INVALID_REQUEST',
        message: 'Request body must include an input string.',
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
