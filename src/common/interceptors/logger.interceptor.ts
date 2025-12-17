import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { catchError, Observable, tap, throwError } from 'rxjs';

interface LogContext {
  method: string;
  url: string;
  startTime: number;
  statusCode?: number;
  responseSize?: number;
  errorMessage?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('LoggingInterceptor');

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const logContext: LogContext = {
      method: request.method,
      url: request.originalUrl,
      startTime: Date.now(),
    };
    this.logRequest(request, logContext);

    return next.handle().pipe(
      tap(() => {
        logContext.statusCode = response.statusCode;
        logContext.responseSize = this.getResponseSize(response);
        this.logResponse(logContext);
      }),
      catchError((error: Error) => {
        logContext.statusCode = (error as any).status || 500;
        logContext.errorMessage = error.message;
        this.logError(logContext, error);
        return throwError(() => error);
      }),
    );
  }
  private logRequest(request: Request, context: LogContext): void {
    const body = this.sanitizeBody(request.body);
    this.logger.debug(
      `→ [${context.method}] ${context.url}`,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ip: request.ip,
        userAgent: request.get('user-agent'),
        body: body,
      }),
    );
  }

  private logResponse(context: LogContext): void {
    const executionTime = Date.now() - context.startTime;
    this.logger.log(
      `← [${context.statusCode}] ${context.method} ${context.url}`,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        statusCode: context.statusCode,
        executionTime: `${executionTime}ms`,
        responseSize: `${context.responseSize}B`,
        performance: this.getPerformanceLevel(executionTime),
      }),
    );
  }

  private logError(context: LogContext, error: Error): void {
    const executionTime = Date.now() - context.startTime;
    this.logger.error(
      `✗ [${context.statusCode}] ${context.method} ${context.url}`,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        statusCode: context.statusCode,
        error: context.errorMessage,
        stack: error.stack,
        executionTime: `${executionTime}ms`,
      }),
    );
  }
  private sanitizeBody(body: any): any {
    if (!body) return null;

    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    const sanitized = { ...body };

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });

    return sanitized;
  }

  private getResponseSize(response: Response): number {
    const contentLength = response.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  }

  private getPerformanceLevel(executionsTime: number): string {
    const performanceLevels = {
      FAST: executionsTime < 100,
      NORMAL: executionsTime < 500,
      SLOW: executionsTime < 1000,
      VERY_SLOW: executionsTime >= 1000,
    };

    return Object.keys(performanceLevels).find((key) => performanceLevels[key]) || 'VERY_SLOW';
  }
}
