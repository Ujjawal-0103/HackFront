import { Injectable } from '@nestjs/common';
import { HealthResponse } from '@traceback/shared-types';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  getHealth(): HealthResponse {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      status: 'ok',
      service: '@traceback/api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds,
    };
  }
}
