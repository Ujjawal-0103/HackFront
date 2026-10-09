import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';
import { ReadinessService } from './readiness.service';
import { HealthResponse, ReadinessResponse } from '@traceback/shared-types';

@Controller()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly readinessService: ReadinessService,
  ) {}

  @Get('health')
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }

  @Get('ready')
  async getReadiness(@Res({ passthrough: true }) res: Response): Promise<ReadinessResponse> {
    const { statusCode, response } = await this.readinessService.checkReadiness();
    res.status(statusCode);
    return response;
  }
}
