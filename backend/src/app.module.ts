import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JasonCliService } from './jason-cli.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, JasonCliService],
})
export class AppModule {}
