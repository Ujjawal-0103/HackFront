import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthResponse } from '@traceback/shared-types';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }
}
