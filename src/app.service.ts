import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealthStatus() {
    return {
      status: 'up',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
