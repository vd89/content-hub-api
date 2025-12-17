import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Observable } from 'rxjs';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
  executionTime: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  private requestStartTime = new Map<string, number>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse> {
    const response = context.switchToHttp().getResponse<Response>();

    const requestId = uuidv4();
    const startTime = Date.now();

    this.requestStartTime.set(requestId, startTime);

    // Add requestId to response headers
    response.setHeader('X-Request-ID', requestId);

    return next.handle().pipe(
      map((data: unknown) => {
        const executionTime = Date.now() - startTime;

        // If response is already formatted, return as-is
        if (this.isApiResponse(data)) {
          return {
            ...data,
            executionTime: this.formatExecutionTime(executionTime),
            requestId,
          };
        }

        // Handle paginated responses
        if (this.isPaginatedResponse(data)) {
          return this.formatPaginatedResponse(data, requestId, executionTime);
        }

        // Handle array responses
        if (Array.isArray(data)) {
          return this.formatArrayResponse(data, requestId, executionTime);
        }

        // Handle single object responses
        return this.formatSuccessResponse(data, requestId, executionTime);
      }),
    );
  }

  private isApiResponse(data: unknown): data is ApiResponse {
    return typeof data === 'object' && data !== null && 'success' in data;
  }

  private isPaginatedResponse(data: unknown): data is { items: unknown[]; meta: Record<string, unknown> } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'items' in data &&
      'meta' in data &&
      Array.isArray((data as { items: unknown }).items)
    );
  }

  private formatSuccessResponse(data: any, requestId: string, executionTime: number): ApiResponse {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      requestId,
      executionTime: this.formatExecutionTime(executionTime),
    };
  }

  private formatArrayResponse(data: any[], requestId: string, executionTime: number): ApiResponse {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      requestId,
      executionTime: this.formatExecutionTime(executionTime),
      pagination: {
        page: 1,
        limit: data.length,
        total: data.length,
        totalPages: 1,
      },
    };
  }

  private formatPaginatedResponse(
    data: { items: unknown[]; meta: Record<string, unknown> },
    requestId: string,
    executionTime: number,
  ): ApiResponse {
    const { items, meta } = data;
    const page = typeof meta.page === 'number' ? meta.page : 1;
    const limit = typeof meta.limit === 'number' ? meta.limit : 10;
    const total = typeof meta.total === 'number' ? meta.total : items.length;

    return {
      success: true,
      data: items,
      timestamp: new Date().toISOString(),
      requestId,
      executionTime: this.formatExecutionTime(executionTime),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private formatExecutionTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

// Global error interceptor for error responses
@Injectable()
export class ErrorTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle();
  }

  static formatErrorResponse(
    error: { getStatus?: () => number; message?: string; getResponse?: () => { message?: string } },
    requestId: string,
  ): ApiResponse {
    const status = error.getStatus?.() ?? 500;
    const message = error.message ?? 'Internal server error';
    const response = error.getResponse?.();

    return {
      success: false,
      error: {
        message,
        code: this.getErrorCode(status),
        details: response?.message ?? null,
      },
      timestamp: new Date().toISOString(),
      requestId,
      executionTime: '0ms',
    };
  }

  private static getErrorCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMIT',
      500: 'INTERNAL_SERVER_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    return codeMap[status] || 'UNKNOWN_ERROR';
  }
}
