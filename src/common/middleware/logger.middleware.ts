import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, headers } = req;
    const body = req.body as Record<string, unknown>;
    const userAgent = headers['user-agent'] || 'unknown';
    const requestId = ((req as Record<string, unknown>)['requestId'] as string) || 'no-request-id';
    const startTime = Date.now();

    this.logger.log(`[${requestId}] Incoming: ${method} ${originalUrl} - UserAgent: ${userAgent}`);

    if (body && Object.keys(body).length > 0) {
      const sanitizedBody = this.sanitizeBody(body);
      this.logger.debug(`[${requestId}] Body: ${JSON.stringify(sanitizedBody)}`);
    }

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      const logMessage = `[${requestId}] Completed: ${method} ${originalUrl} - Status: ${statusCode} - Duration: ${duration}ms`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }

  private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
    const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'creditCard', 'cvv'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Handle nested objects
    for (const key of Object.keys(sanitized)) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
        sanitized[key] = this.sanitizeBody(sanitized[key] as Record<string, unknown>);
      }
    }

    return sanitized;
  }
}
