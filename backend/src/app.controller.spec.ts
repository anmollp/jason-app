import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JasonCliService } from './jason-cli.service';

describe('AppController', () => {
  let appController: AppController;
  let jasonCliService: { diff: jest.Mock; format: jest.Mock };

  beforeEach(async () => {
    jasonCliService = {
      diff: jest.fn(),
      format: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: JasonCliService,
          useValue: jasonCliService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('formatJson', () => {
    it('formats valid JSON through the Jason CLI service', async () => {
      jasonCliService.format.mockResolvedValue(
        '{\n  "service": "billing",\n  "retry": true\n}',
      );

      await expect(
        appController.formatJson({
          input: '{"service":"billing","retry":true}',
        }),
      ).resolves.toEqual({
        output: '{\n  "service": "billing",\n  "retry": true\n}',
      });
      expect(jasonCliService.format).toHaveBeenCalledWith(
        '{"service":"billing","retry":true}',
      );
    });

    it('rejects requests without an input string', async () => {
      await expect(
        appController.formatJson({ input: undefined } as unknown as {
          input: string;
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns a friendly error for invalid JSON', async () => {
      jasonCliService.format.mockRejectedValue(
        new Error('expected value at line 1 column 1'),
      );

      await expect(
        appController.formatJson({
          input: '{ "service": "billing", retry: true }',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('diffJson', () => {
    it('returns patch operations and summary through the Jason CLI service', async () => {
      jasonCliService.diff.mockResolvedValue(
        '[\n  {"op":"replace","path":"/a","value":2},\n  {"op":"add","path":"/b","value":true}\n]',
      );

      await expect(
        appController.diffJson({
          before: '{"a":1}',
          after: '{"a":2,"b":true}',
        }),
      ).resolves.toEqual({
        operations: [
          { op: 'replace', path: '/a', value: 2 },
          { op: 'add', path: '/b', value: true },
        ],
        summary: {
          added: 1,
          changes: 2,
          removed: 0,
          replaced: 1,
        },
      });
      expect(jasonCliService.diff).toHaveBeenCalledWith(
        '{"a":1}',
        '{"a":2,"b":true}',
      );
    });

    it('rejects requests without before and after strings', async () => {
      await expect(
        appController.diffJson({ before: '{"a":1}' } as unknown as {
          before: string;
          after: string;
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns a friendly error for invalid diff JSON', async () => {
      jasonCliService.diff.mockRejectedValue(
        new Error('after: expected value at line 1 column 1'),
      );

      await expect(
        appController.diffJson({
          before: '{"a":1}',
          after: '{ a: 2 }',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
