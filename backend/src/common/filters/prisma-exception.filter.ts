import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.BAD_REQUEST;
    let message = 'Database request failed';

    if (exception.code === 'P2002') {
      statusCode = HttpStatus.CONFLICT;
      message = `Unique constraint failed on: ${String(exception.meta?.target ?? 'unknown field')}`;
    }

    if (exception.code === 'P2025') {
      statusCode = HttpStatus.NOT_FOUND;
      message = 'Requested record not found';
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
      errorCode: exception.code,
      details: exception.meta,
      prismaCode: exception.code,
    });
  }
}
