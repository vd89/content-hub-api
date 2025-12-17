import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  Logger,
  RequestTimeoutException,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { Request } from 'express';

interface TimeoutConfig {
  path: string;
  methods?: string[];
  timeoutMs: number;
}

// Route-specific timeout configurations
const TIMEOUT_CONFIG: TimeoutConfig[] = [
  {
    path: '/api/reports',
    timeoutMs: 30000, // 30 seconds for heavy operations
    methods: ['GET', 'POST'],
  },
  {
    path: '/api/export',
    timeoutMs: 60000, // 60 seconds for exports
  },
  {
    path: '/api/upload',
    timeoutMs: 120000, // 2 minutes for uploads
  },
  // Default timeout
];

const DEFAULT_TIMEOUT = 10000; // 10 seconds

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger('TimeoutInterceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const timeoutMs = this.getTimeoutForRequest(request);

    this.logger.debug(`Setting timeout of ${timeoutMs}ms for ${request.method} ${request.path}`);

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error: Error) => {
        if (error.name === 'TimeoutError') {
          this.logger.warn(`Request timeout after ${timeoutMs}ms: ${request.method} ${request.path}`);

          throw new RequestTimeoutException(`Request timeout: Maximum execution time of ${timeoutMs}ms exceeded`);
        }

        throw error;
      }),
    );
  }

  private getTimeoutForRequest(request: Request): number {
    const { path, method } = request;

    // Find matching configuration
    for (const config of TIMEOUT_CONFIG) {
      if (path.startsWith(config.path)) {
        // Check if method matches (if specified)
        if (!config.methods || config.methods.includes(method)) {
          return config.timeoutMs;
        }
      }
    }

    // Return default timeout
    return DEFAULT_TIMEOUT;
  }
}

// Utility service for managing timeout configurations
@Injectable()
export class TimeoutService {
  private config: TimeoutConfig[] = [...TIMEOUT_CONFIG];
  private readonly logger = new Logger('TimeoutService');

  setTimeoutForRoute(path: string, timeoutMs: number, methods?: string[]): void {
    // Remove existing config for this path
    this.config = this.config.filter((c) => c.path !== path);

    // Add new config
    this.config.push({ path, timeoutMs, methods });
    this.logger.log(`Updated timeout for ${path}: ${timeoutMs}ms`);
  }

  getConfig(): TimeoutConfig[] {
    return [...this.config];
  }

  resetConfig(): void {
    this.config = [...TIMEOUT_CONFIG];
    this.logger.log('Timeout configuration reset to defaults');
  }
}
