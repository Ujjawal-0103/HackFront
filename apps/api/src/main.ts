import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const configService = app.get(ConfigService);
  const port = configService.get<number>("app.port", 3001);
  const corsOrigin = configService.get<string>(
    "app.corsOrigin",
    "http://localhost:3000",
  );

  // Prefix all endpoints with /api
  app.setGlobalPrefix("api");

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filter for structured error envelopes
  app.useGlobalFilters(new HttpExceptionFilter());

  // Configure CORS for web frontend supporting local dev and configured origin
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const isAllowed =
        origin === corsOrigin ||
        origin === "http://localhost:3000" ||
        origin === "http://127.0.0.1:3000" ||
        /^http:\/\/localhost:[0-9]+$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin);
      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-workspace-id",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
  });

  await app.listen(port, "0.0.0.0");
  logger.log(`Traceback API running on http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal API bootstrap error:", err);
  process.exit(1);
});
