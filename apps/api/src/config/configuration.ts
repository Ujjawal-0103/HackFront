export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  githubWebhookSecret?: string;
  neo4jUri?: string;
  neo4jUsername?: string;
  neo4jPassword?: string;
  neo4jDatabase?: string;
}

export const configuration = (): { app: AppConfig } => {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const port = parseInt(process.env.PORT || "3001", 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(
      `[Config Error] PORT must be a valid port number (1-65535). Received: ${process.env.PORT}`,
    );
  }

  const corsOrigin = process.env.WEB_URL || "http://localhost:3000";

  const rawDbUrl = process.env.DATABASE_URL?.trim();
  const defaultDevDbUrl =
    "postgresql://postgres:postgrespassword@localhost:5434/traceback_dev?schema=public";

  if (isProduction) {
    if (!rawDbUrl) {
      throw new Error(
        "[Config Error] DATABASE_URL is required in production environment but was not provided.",
      );
    }
    if (
      rawDbUrl === defaultDevDbUrl ||
      rawDbUrl.includes("postgrespassword@localhost")
    ) {
      throw new Error(
        "[Config Error] Default development DATABASE_URL with placeholder credentials cannot be used in production.",
      );
    }
    if (
      !rawDbUrl.startsWith("postgresql://") &&
      !rawDbUrl.startsWith("postgres://")
    ) {
      throw new Error(
        "[Config Error] DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://.",
      );
    }
  }

  const databaseUrl = rawDbUrl || defaultDevDbUrl;
  const redisHost = process.env.REDIS_HOST || "localhost";
  const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
  const redisPassword = process.env.REDIS_PASSWORD || undefined;

  const rawWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  const githubWebhookSecret = isProduction
    ? rawWebhookSecret || undefined
    : rawWebhookSecret || "development-webhook-secret";

  const neo4jUri = process.env.NEO4J_URI?.trim() || undefined;
  const neo4jUsername = process.env.NEO4J_USERNAME?.trim() || undefined;
  const neo4jPassword = process.env.NEO4J_PASSWORD?.trim() || undefined;
  const neo4jDatabase = process.env.NEO4J_DATABASE?.trim() || "neo4j";

  return {
    app: {
      nodeEnv,
      port,
      corsOrigin,
      databaseUrl,
      redisHost,
      redisPort,
      redisPassword,
      githubWebhookSecret,
      neo4jUri,
      neo4jUsername,
      neo4jPassword,
      neo4jDatabase,
    },
  };
};
