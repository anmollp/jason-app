import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureBodyParser } from './../src/body-parser.config';
import { JasonCliService } from './../src/jason-cli.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const jasonCliService = {
    diff: jest.fn(() => Promise.resolve('[]')),
    format: jest.fn((input: string) => {
      const parsed = JSON.parse(input) as unknown;

      return Promise.resolve(JSON.stringify(parsed, null, 2));
    }),
    patch: jest.fn(() => Promise.resolve('{"records":[]}')),
    pointer: jest.fn(() => Promise.resolve('"record-0"')),
  };

  beforeEach(async () => {
    jasonCliService.diff.mockClear();
    jasonCliService.format.mockClear();
    jasonCliService.patch.mockClear();
    jasonCliService.pointer.mockClear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(JasonCliService)
      .useValue(jasonCliService)
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureBodyParser(app);
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

  it('/format (POST) accepts JSON documents larger than the default body limit', () => {
    const largeInput = createLargeInput();

    expect(
      Buffer.byteLength(JSON.stringify({ input: largeInput })),
    ).toBeGreaterThan(100 * 1024);

    return request(app.getHttpServer())
      .post('/format')
      .send({ input: largeInput })
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as { output?: unknown };

        expect(responseBody.output).toEqual(expect.any(String));
        expect(jasonCliService.format).toHaveBeenCalledWith(largeInput);
      });
  });

  it('/diff (POST) accepts request bodies larger than the default body limit', () => {
    const before = createLargeInput();
    const after = createLargeInput();

    expect(Buffer.byteLength(JSON.stringify({ before, after }))).toBeGreaterThan(
      100 * 1024,
    );

    return request(app.getHttpServer())
      .post('/diff')
      .send({ before, after })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          operations: [],
          summary: { changes: 0 },
        });
        expect(jasonCliService.diff).toHaveBeenCalledWith(before, after);
      });
  });

  it('/patch (POST) accepts request bodies larger than the default body limit', () => {
    const document = createLargeInput();
    const patch = '[{"op":"remove","path":"/records/0"}]';

    expect(Buffer.byteLength(JSON.stringify({ document, patch }))).toBeGreaterThan(
      100 * 1024,
    );

    return request(app.getHttpServer())
      .post('/patch')
      .send({ document, patch })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          output: '{"records":[]}',
          summary: { operations: 1, removed: 1 },
        });
        expect(jasonCliService.patch).toHaveBeenCalledWith(document, patch);
      });
  });

  it('/pointer (POST) accepts request bodies larger than the default body limit', () => {
    const document = createLargeInput();
    const path = '/records/0';

    expect(Buffer.byteLength(JSON.stringify({ document, path }))).toBeGreaterThan(
      100 * 1024,
    );

    return request(app.getHttpServer())
      .post('/pointer')
      .send({ document, path })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          output: '"record-0"',
          summary: { found: true, path },
        });
        expect(jasonCliService.pointer).toHaveBeenCalledWith(document, path);
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

function createLargeInput() {
  return JSON.stringify({
    records: Array.from({ length: 8000 }, (_, index) => ({
      enabled: index % 2 === 0,
      id: index,
      label: `record-${index}`,
    })),
  });
}
