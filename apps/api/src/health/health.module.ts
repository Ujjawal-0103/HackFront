import { Module, OnModuleInit } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { ReadinessService } from "./readiness.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [HealthController],
  providers: [HealthService, ReadinessService],
  exports: [HealthService, ReadinessService],
})
export class HealthModule implements OnModuleInit {
  constructor(
    private readonly readinessService: ReadinessService,
    private readonly prismaService: PrismaService,
  ) {}

  onModuleInit() {
    this.readinessService.setDatabaseIndicator(this.prismaService);
  }
}
