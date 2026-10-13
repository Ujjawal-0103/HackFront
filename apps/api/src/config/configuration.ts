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
  const port = parseInt(process.env.PORT || "3001", 10);
  const corsOrigin = process.env.WEB_URL || "http://localhost:3000";
  const databaseUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgrespassword@localhost:5434/traceback_dev?schema=public";
  const redisHost = process.env.REDIS_HOST || "localhost";
  const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
  const redisPassword = process.env.REDIS_PASSWORD || undefined;
  const isProduction = nodeEnv === "production";
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
