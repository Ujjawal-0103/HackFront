import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Optional,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { DatabaseHealthIndicator } from "../health/readiness.service";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, DatabaseHealthIndicator
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(
    @Optional() options?: ConstructorParameters<typeof PrismaClient>[0],
  ) {
    super(
      options || {
        datasources: {
          db: {
            url:
              process.env.DATABASE_URL ||
              "postgresql://postgres:postgrespassword@localhost:5434/traceback_test?schema=public",
          },
        },
      },
    );
  }

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
      const rawMessage =
        err instanceof Error ? err.message : "Database ping query failed";
      return {
        healthy: false,
        message: this.sanitizeHealthMessage(rawMessage),
      };
    }
  }

  private sanitizeHealthMessage(message: string): string {
    if (!message) return "Database ping query failed";
    return message
      .replace(/postgresql:\/\/[^\s"'`]+/gi, "[REDACTED_URL]")
      .replace(/postgrespassword/gi, "[REDACTED]")
      .replace(/password[^\s,;)]*/gi, "[REDACTED]")
      .replace(/\b5434\b/g, "[PORT]")
      .replace(/:\d{2,5}\b/g, ":[PORT]")
      .replace(/at\s+[`'"][^`'"]+[`'"]/gi, "at [REDACTED_ENDPOINT]");
  }
}
