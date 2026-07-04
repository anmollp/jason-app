import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('formatJson', () => {
    it('formats valid JSON with two-space indentation', () => {
      expect(
        appController.formatJson({
          input: '{"service":"billing","retry":true}',
        }),
      ).toEqual({
        output: '{\n  "service": "billing",\n  "retry": true\n}',
      });
    });

    it('rejects requests without an input string', () => {
      expect(() =>
        appController.formatJson({ input: undefined } as unknown as {
          input: string;
        }),
      ).toThrow(BadRequestException);
    });

    it('returns a friendly error for invalid JSON', () => {
      expect(() =>
        appController.formatJson({
          input: '{ "service": "billing", retry: true }',
        }),
      ).toThrow(BadRequestException);
    });
  });
});
