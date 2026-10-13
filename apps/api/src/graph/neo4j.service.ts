import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import neo4j, { Driver, Session, Record as Neo4jRecord } from "neo4j-driver";

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);
  private driver?: Driver;
  private available = false;
  private databaseName = "neo4j";

  constructor(@Optional() private readonly configService?: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const uri =
      this.configService?.get<string>("app.neo4jUri") ||
      process.env.NEO4J_URI?.trim();
    const username =
      this.configService?.get<string>("app.neo4jUsername") ||
      process.env.NEO4J_USERNAME?.trim();
    const password =
      this.configService?.get<string>("app.neo4jPassword") ||
      process.env.NEO4J_PASSWORD?.trim();
    this.databaseName =
      this.configService?.get<string>("app.neo4jDatabase") ||
      process.env.NEO4J_DATABASE?.trim() ||
      "neo4j";

    if (!uri) {
      this.logger.log(
        "Neo4j configuration not detected; graph-assisted features will operate in baseline fallback mode.",
      );
      this.available = false;
      return;
    }

    try {
      const auth =
        username && password ? neo4j.auth.basic(username, password) : undefined;

      this.driver = neo4j.driver(uri, auth, {
        connectionTimeout: 3000,
        maxConnectionPoolSize: 20,
      });

      const serverInfo = await this.driver.getServerInfo();
      this.available = true;
      this.logger.log(
        `Neo4j connected successfully: ${serverInfo.address} (${serverInfo.agent})`,
      );
    } catch (err) {
      this.available = false;
      this.logger.warn(
        `Neo4j service unavailable at ${uri}. Graph-assisted retrieval will degrade to baseline search: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.driver) {
      try {
        await this.driver.close();
      } catch (err) {
        this.logger.warn(`Error closing Neo4j driver: ${String(err)}`);
      }
    }
    this.available = false;
  }

  /**
   * Returns true if Neo4j connection is active and healthy.
   */
  isAvailable(): boolean {
    return this.available && Boolean(this.driver);
  }

  /**
   * Health check indicator for readiness probes.
   */
  async isHealthy(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.driver || !this.available) {
      return {
        healthy: false,
        message: "Neo4j graph driver is not connected or configured",
      };
    }

    try {
      const session = this.getSession();
      try {
        await session.run("RETURN 1 AS ping");
        return { healthy: true, message: "Neo4j graph database responsive" };
      } finally {
        await session.close();
      }
    } catch (err) {
      return {
        healthy: false,
        message: err instanceof Error ? err.message : "Neo4j ping query failed",
      };
    }
  }

  /**
   * Executes a Cypher query with parameters.
   */
  async runQuery(
    cypher: string,
    params: Record<string, any> = {},
  ): Promise<Neo4jRecord[]> {
    if (!this.driver || !this.available) {
      throw new Error(
        "Neo4j driver is not available. Check isAvailable() before querying.",
      );
    }

    const session = this.getSession();
    try {
      const result = await session.run(cypher, params);
      return result.records;
    } finally {
      await session.close();
    }
  }

  /**
   * Executes write operations within a transaction.
   */
  async writeTransaction<T>(
    work: (txSession: Session) => Promise<T>,
  ): Promise<T> {
    if (!this.driver || !this.available) {
      throw new Error("Neo4j driver is not available for write transactions.");
    }

    const session = this.getSession();
    try {
      return await work(session);
    } finally {
      await session.close();
    }
  }

  private getSession(): Session {
    if (!this.driver) {
      throw new Error("Neo4j driver is uninitialized");
    }
    return this.driver.session({ database: this.databaseName });
  }
}
