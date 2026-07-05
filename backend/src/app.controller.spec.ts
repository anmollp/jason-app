import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JasonCliService } from './jason-cli.service';

describe('AppController', () => {
  let appController: AppController;
  let jasonCliService: { format: jest.Mock };

  beforeEach(async () => {
    jasonCliService = {
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
});
