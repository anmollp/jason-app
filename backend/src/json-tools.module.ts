import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { JasonCliService } from './jason-cli.service';

@Module({
  providers: [AppService, JasonCliService],
  exports: [AppService, JasonCliService],
})
export class JsonToolsModule {}
