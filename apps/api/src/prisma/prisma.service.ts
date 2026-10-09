import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { DatabaseHealthIndicator } from "../health/readiness.service";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, DatabaseHealthIndicator
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Graceful initial connect attempt
    try {
      await this.$connect();
      this.logger.log("Prisma connected to PostgreSQL");
    } catch (err) {
      this.logger.warn(
        `Prisma initial connection deferred: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async isHealthy(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return { healthy: true, message: "PostgreSQL database responsive" };
    } catch (err) {
      return {
        healthy: false,
        message:
          err instanceof Error ? err.message : "Database ping query failed",
      };
    }
  }
}
