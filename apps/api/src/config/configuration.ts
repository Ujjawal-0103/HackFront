export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  githubWebhookSecret?: string;
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
    },
  };
};
