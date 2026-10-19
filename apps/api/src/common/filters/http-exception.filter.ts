import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response, Request } from "express";
import { ApiErrorResponse } from "@traceback/shared-types";

export function redactSecrets(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(/postgresql:\/\/([^:]+):([^@]+)@/gi, "postgresql://$1:[REDACTED]@")
    .replace(/postgres:\/\/([^:]+):([^@]+)@/gi, "postgres://$1:[REDACTED]@")
    .replace(/bolt:\/\/([^:]+):([^@]+)@/gi, "bolt://$1:[REDACTED]@")
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]")
    .replace(
      /(?:password|passwd|pwd|secret|token|api[_-]?key)=([^\s&;]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(
      /(?:tb_token_|traceback_token_|tb_live_)[a-zA-Z0-9_\-\.]+/gi,
      "[REDACTED_TOKEN]",
    );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal server error";
    let code = "INTERNAL_ERROR";
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string | string[]) || exception.message;
        code = (resObj.error as string) || `HTTP_${status}`;
        details = resObj.details;
      }
    } else if (exception instanceof Error) {
      // Do not expose arbitrary internal error messages or traces to clients in production
      const safeMessage = redactSecrets(exception.message);
      const safeStack = exception.stack
        ? redactSecrets(exception.stack)
        : undefined;
      this.logger.error(
        `Unhandled Exception on ${request?.url}: ${safeMessage}`,
        safeStack,
      );
      message = "An unexpected internal error occurred";
      code = "INTERNAL_UNHANDLED";
    }

    const sanitizedMessage = Array.isArray(message)
      ? message.map((m) => redactSecrets(String(m))).join("; ")
      : redactSecrets(String(message));

    const errorPayload: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message: sanitizedMessage,
        details,
      },
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorPayload);
  }
}
