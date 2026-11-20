import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, throwError, timeout, TimeoutError, catchError } from 'rxjs';

const LONG_OPERATION_URL_PATTERN = /\/(import|pdf|exports|app-releases)\b/;

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(
    private readonly defaultTimeoutMs = 30_000,
    private readonly longOperationTimeoutMs = 180_000,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request | undefined>();
    const url = req?.originalUrl ?? req?.url ?? '';
    const contentType = String(req?.headers?.['content-type'] ?? '');
    const isLongOperation =
      LONG_OPERATION_URL_PATTERN.test(url) ||
      contentType.includes('multipart/form-data');

    const effectiveTimeoutMs = isLongOperation
      ? this.longOperationTimeoutMs
      : this.defaultTimeoutMs;

    return next.handle().pipe(
      timeout(effectiveTimeoutMs),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException('Request timed out'));
        }

        return throwError(() => error);
      }),
    );
  }
}
