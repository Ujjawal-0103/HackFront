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

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let code = "INTERNAL_ERROR";
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string) || exception.message;
        code = (resObj.error as string) || `HTTP_${status}`;
        details = resObj.details;
      }
    } else if (exception instanceof Error) {
      // Do not expose arbitrary internal error messages or traces to clients in production
      this.logger.error(
        `Unhandled Exception on ${request?.url}: ${exception.message}`,
        exception.stack,
      );
      message = "An unexpected internal error occurred";
      code = "INTERNAL_UNHANDLED";
    }

    const errorPayload: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message: Array.isArray(message) ? message.join("; ") : message,
        details,
      },
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorPayload);
  }
}
