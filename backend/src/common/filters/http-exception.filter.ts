import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const message =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object' && typeof (raw as { message?: unknown }).message === 'string'
          ? (raw as { message: string }).message
          : Array.isArray((raw as { message?: unknown[] })?.message)
            ? (raw as { message: string[] }).message[0]
            : 'Internal server error';

    let errorCode: string | undefined;
    let details: unknown;

    if (raw && typeof raw === 'object') {
      const rawObject = raw as { code?: unknown; details?: unknown };

      if (typeof rawObject.code === 'string') {
        errorCode = rawObject.code;
      }

      if (rawObject.details !== undefined) {
        details = rawObject.details;
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
      errorCode,
      details,
    });
  }
}
