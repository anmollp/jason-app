import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AgentModule } from './agent/agent.module';
import { JsonToolsModule } from './json-tools.module';

@Module({
  imports: [JsonToolsModule, AgentModule],
  controllers: [AppController],
})
export class AppModule {}
