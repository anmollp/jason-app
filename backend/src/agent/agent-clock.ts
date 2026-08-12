import { Injectable } from '@nestjs/common';

@Injectable()
export class AgentClock {
  now(): Date {
    return new Date();
  }
}
