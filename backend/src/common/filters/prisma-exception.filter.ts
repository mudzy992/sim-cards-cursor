import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ErrorCodes } from '../constants/error-codes';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.BAD_REQUEST;
    let message = 'Database request failed';
    let errorCode: string = exception.code;

    if (exception.code === 'P2002') {
      statusCode = HttpStatus.CONFLICT;
      message = 'Record with this unique value already exists';
      errorCode = ErrorCodes.PRISMA_UNIQUE_CONFLICT;
    } else if (exception.code === 'P2025') {
      statusCode = HttpStatus.NOT_FOUND;
      message = 'Requested record not found';
      errorCode = ErrorCodes.PRISMA_RECORD_NOT_FOUND;
    } else if (exception.code === 'P2003') {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Referenced record does not exist';
      errorCode = ErrorCodes.PRISMA_FOREIGN_KEY_VIOLATION;
    } else if (exception.code === 'P2014') {
      statusCode = HttpStatus.CONFLICT;
      message = 'Required relation constraint failed';
      errorCode = ErrorCodes.PRISMA_RELATION_VIOLATION;
    }

    const isProd = process.env.NODE_ENV === 'production';

    response.status(statusCode).json({
      success: false,
      statusCode,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
      errorCode,
      ...(isProd ? {} : { details: exception.meta }),
    });
  }
}
