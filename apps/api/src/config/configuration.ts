export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
}

export const configuration = (): { app: AppConfig } => {
  const nodeEnv = process.env.NODE_ENV || "development";
  const port = parseInt(process.env.PORT || "3001", 10);
  const corsOrigin = process.env.WEB_URL || "http://localhost:3000";
  const databaseUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/traceback_dev?schema=public";
  const redisHost = process.env.REDIS_HOST || "localhost";
  const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

  return {
    app: {
      nodeEnv,
      port,
      corsOrigin,
      databaseUrl,
      redisHost,
      redisPort,
    },
  };
};
