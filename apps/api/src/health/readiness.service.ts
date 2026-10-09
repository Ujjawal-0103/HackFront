import { Injectable, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ReadinessResponse, DependencyCheck } from "@traceback/shared-types";

export interface DatabaseHealthIndicator {
  isHealthy(): Promise<{ healthy: boolean; message?: string }>;
}

@Injectable()
export class ReadinessService {
  private dbIndicator: DatabaseHealthIndicator | null = null;

  constructor(private readonly configService: ConfigService) {}

  setDatabaseIndicator(indicator: DatabaseHealthIndicator) {
    this.dbIndicator = indicator;
  }

  async checkReadiness(): Promise<{
    statusCode: HttpStatus;
    response: ReadinessResponse;
  }> {
    const configCheck: DependencyCheck = this.checkConfig();
    const dbCheck: DependencyCheck = await this.checkDatabase();

    const isReady = configCheck.ready && dbCheck.ready;

    const response: ReadinessResponse = {
      status: isReady ? "ready" : "not_ready",
      service: "@traceback/api",
      timestamp: new Date().toISOString(),
      checks: {
        config: configCheck,
        database: dbCheck,
      },
    };

    return {
      statusCode: isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
      response,
    };
  }

  private checkConfig(): DependencyCheck {
    const port = this.configService.get<number>("app.port");
    const dbUrl = this.configService.get<string>("app.databaseUrl");

    if (!port || !dbUrl) {
      return {
        ready: false,
        message: "Missing essential environment configuration",
      };
    }

    return {
      ready: true,
      message: "Configuration validated successfully",
    };
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    if (!this.dbIndicator) {
      // When database indicator is not yet bound (e.g. initial boot before connection pool)
      return {
        ready: false,
        message: "Database connection indicator not initialized or connected",
      };
    }

    try {
      const result = await this.dbIndicator.isHealthy();
      return {
        ready: result.healthy,
        message:
          result.message ||
          (result.healthy
            ? "Database responsive"
            : "Database connection failed"),
      };
    } catch (err) {
      return {
        ready: false,
        message: err instanceof Error ? err.message : "Database check failed",
      };
    }
  }
}
