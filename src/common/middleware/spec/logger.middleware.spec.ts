import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerMiddleware } from '../logger.middleware';

describe('LoggerMiddleware', () => {
  let middleware: LoggerMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let loggerLogSpy: jest.SpyInstance;
  let loggerDebugSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggerMiddleware],
    }).compile();

    middleware = module.get<LoggerMiddleware>(LoggerMiddleware);

    // Spy on Logger methods
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    // Mock next function
    mockNext = jest.fn();

    // Mock response with EventEmitter-like behavior
    const listeners: { [key: string]: Array<(...args: unknown[]) => void> } = {};
    mockResponse = {
      statusCode: 200,
      on: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
        if (!listeners[event]) {
          listeners[event] = [];
        }
        listeners[event].push(callback);
        return mockResponse as Response;
      }),
      emit: jest.fn((event: string, ...args: unknown[]) => {
        if (listeners[event]) {
          listeners[event].forEach((callback) => callback(...args));
        }
        return true;
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Logging', () => {
    it('should log incoming request with method and URL', () => {
      mockRequest = {
        method: 'GET',
        originalUrl: '/api/users',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        body: {},
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('Incoming: GET /api/users'));
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use "unknown" when user-agent is missing', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/posts',
        headers: {},
        body: {},
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('UserAgent: unknown'));
    });

    it('should handle missing requestId', () => {
      mockRequest = {
        method: 'GET',
        originalUrl: '/api/test',
        headers: {},
        body: {},
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('[no-request-id]'));
    });

    it('should use requestId when present', () => {
      mockRequest = {
        method: 'GET',
        originalUrl: '/api/test',
        headers: {},
        body: {},
        requestId: 'test-request-id-123',
      } as Request & { requestId: string };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('[test-request-id-123]'));
    });
  });

  describe('Request Body Logging', () => {
    it('should log request body when present', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/users',
        headers: {},
        body: { name: 'John Doe', email: 'john@example.com' },
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Body: {"name":"John Doe","email":"john@example.com"}'),
      );
    });

    it('should not log body when empty', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/users',
        headers: {},
        body: {},
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).not.toHaveBeenCalled();
    });

    it('should not log body when null', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/users',
        headers: {},
        body: null,
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).not.toHaveBeenCalled();
    });

    it('should not log body when undefined', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/users',
        headers: {},
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).not.toHaveBeenCalled();
    });
  });

  describe('Sensitive Data Sanitization', () => {
    it('should sanitize password field', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/auth/login',
        headers: {},
        body: { email: 'user@example.com', password: 'secret123' },
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('[REDACTED]'));
      expect(loggerDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining('secret123'));
    });

    it('should sanitize multiple sensitive fields', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/payment',
        headers: {},
        body: {
          username: 'john',
          password: 'pass123',
          token: 'abc-token',
          secret: 'my-secret',
          creditCard: '4111-1111-1111-1111',
        },
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      const calls = loggerDebugSpy.mock.calls as Array<[string]>;
      const debugCall = calls[0][0];
      expect(debugCall).toContain('[REDACTED]');
      expect(debugCall).not.toContain('pass123');
      expect(debugCall).not.toContain('abc-token');
      expect(debugCall).not.toContain('my-secret');
      expect(debugCall).not.toContain('4111-1111-1111-1111');
      expect(debugCall).toContain('john');
    });

    it('should sanitize nested sensitive fields', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/users',
        headers: {},
        body: {
          user: {
            name: 'John',
            credentials: {
              password: 'secret123',
              token: 'auth-token',
            },
          },
        },
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      const calls = loggerDebugSpy.mock.calls as Array<[string]>;
      const debugCall = calls[0][0];
      expect(debugCall).toContain('[REDACTED]');
      expect(debugCall).not.toContain('secret123');
      expect(debugCall).not.toContain('auth-token');
      expect(debugCall).toContain('John');
    });

    it('should handle arrays in request body', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/bulk',
        headers: {},
        body: {
          users: [
            { name: 'User1', password: 'pass1' },
            { name: 'User2', password: 'pass2' },
          ],
        },
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).toHaveBeenCalled();
      const calls = loggerDebugSpy.mock.calls as Array<[string]>;
      const debugCall = calls[0][0];
      expect(debugCall).toContain('User1');
      expect(debugCall).toContain('User2');
    });

    it('should not modify non-sensitive fields', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/users',
        headers: {},
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
        },
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      const calls = loggerDebugSpy.mock.calls as Array<[string]>;
      const debugCall = calls[0][0];
      expect(debugCall).toContain('John Doe');
      expect(debugCall).toContain('john@example.com');
      expect(debugCall).toContain('30');
    });
  });

  describe('Response Logging', () => {
    it('should log successful response (2xx)', () => {
      mockRequest = {
        method: 'GET',
        originalUrl: '/api/users',
        headers: {},
        body: {},
      } as Request;

      mockResponse.statusCode = 200;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate response finish
      (mockResponse.emit as jest.Mock)('finish');

      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('Completed: GET /api/users - Status: 200'));
      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Duration: \d+ms/));
    });

    it('should log client error response (4xx) as warning', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/users',
        headers: {},
        body: {},
      } as Request;

      mockResponse.statusCode = 404;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      (mockResponse.emit as jest.Mock)('finish');

      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Completed: POST /api/users - Status: 404'));
    });

    it('should log validation error (400) as warning', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/users',
        headers: {},
        body: {},
      } as Request;

      mockResponse.statusCode = 400;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      (mockResponse.emit as jest.Mock)('finish');

      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Status: 400'));
    });

    it('should log server error response (5xx) as error', () => {
      mockRequest = {
        method: 'GET',
        originalUrl: '/api/users',
        headers: {},
        body: {},
      } as Request;

      mockResponse.statusCode = 500;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      (mockResponse.emit as jest.Mock)('finish');

      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Completed: GET /api/users - Status: 500'));
    });

    it('should log service unavailable (503) as error', () => {
      mockRequest = {
        method: 'GET',
        originalUrl: '/api/health',
        headers: {},
        body: {},
      } as Request;

      mockResponse.statusCode = 503;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      (mockResponse.emit as jest.Mock)('finish');

      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Status: 503'));
    });

    it('should calculate request duration accurately', (done) => {
      mockRequest = {
        method: 'GET',
        originalUrl: '/api/slow',
        headers: {},
        body: {},
      } as Request;

      mockResponse.statusCode = 200;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      setTimeout(() => {
        (mockResponse.emit as jest.Mock)('finish');

        const calls = loggerLogSpy.mock.calls as Array<[string]>;
        const logCall = calls.find((call) => call[0].includes('Duration:'));
        expect(logCall).toBeDefined();
        const durationMatch = logCall?.[0].match(/Duration: (\d+)ms/);
        expect(durationMatch).toBeDefined();
        const duration = parseInt(durationMatch?.[1] || '0', 10);
        expect(duration).toBeGreaterThanOrEqual(50);
        done();
      }, 50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle request with special characters in URL', () => {
      mockRequest = {
        method: 'GET',
        originalUrl: '/api/search?query=hello%20world&filter=active',
        headers: {},
        body: {},
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/search?query=hello%20world&filter=active'),
      );
    });

    it('should handle deeply nested objects', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/complex',
        headers: {},
        body: {
          level1: {
            level2: {
              level3: {
                password: 'deep-secret',
                data: 'visible',
              },
            },
          },
        },
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      const calls = loggerDebugSpy.mock.calls as Array<[string]>;
      const debugCall = calls[0][0];
      expect(debugCall).toContain('[REDACTED]');
      expect(debugCall).not.toContain('deep-secret');
      expect(debugCall).toContain('visible');
    });

    it('should handle circular references gracefully', () => {
      const circularObj: Record<string, unknown> = { name: 'test' };
      circularObj.self = circularObj;

      mockRequest = {
        method: 'POST',
        originalUrl: '/api/circular',
        headers: {},
        body: circularObj,
      } as Request;

      expect(() => {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      }).not.toThrow();

      // Should log with [Circular] marker
      expect(loggerDebugSpy).toHaveBeenCalled();
      const calls = loggerDebugSpy.mock.calls as Array<[string]>;
      const debugCall = calls[0][0];
      expect(debugCall).toContain('[Circular]');
    });

    it('should handle body with null values', () => {
      mockRequest = {
        method: 'POST',
        originalUrl: '/api/test',
        headers: {},
        body: {
          name: 'John',
          middleName: null,
          address: null,
        },
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).toHaveBeenCalled();
    });

    it('should handle very long request URLs', () => {
      const longUrl = '/api/test?' + 'a=1&'.repeat(100);
      mockRequest = {
        method: 'GET',
        originalUrl: longUrl,
        headers: {},
        body: {},
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining(longUrl));
    });

    it('should handle JSON serialization errors gracefully', () => {
      // Create an object that will cause JSON.stringify to throw
      const problematicObj: Record<string, unknown> = {
        name: 'test',
        toJSON: () => {
          throw new Error('JSON serialization error');
        },
      };

      mockRequest = {
        method: 'POST',
        originalUrl: '/api/error',
        headers: {},
        body: problematicObj,
      } as Request;

      expect(() => {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      }).not.toThrow();

      // Should log the error message
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Unable to serialize - circular reference detected]'),
      );
    });

    it('should handle objects with BigInt values', () => {
      // BigInt cannot be serialized by JSON.stringify
      const bigIntObj: Record<string, unknown> = {
        name: 'test',
        bigNumber: BigInt(9007199254740991),
      };

      mockRequest = {
        method: 'POST',
        originalUrl: '/api/bigint',
        headers: {},
        body: bigIntObj,
      } as Request;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Should log the error message for serialization failure
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Unable to serialize - circular reference detected]'),
      );
    });
  });

  describe('Multiple Requests', () => {
    it('should handle multiple concurrent requests independently', () => {
      const request1: Partial<Request> = {
        method: 'GET',
        originalUrl: '/api/users/1',
        headers: {},
        body: {},
        requestId: 'req-1',
      } as Request & { requestId: string };

      const request2: Partial<Request> = {
        method: 'POST',
        originalUrl: '/api/posts',
        headers: {},
        body: { title: 'Test Post' },
        requestId: 'req-2',
      } as Request & { requestId: string };

      middleware.use(request1 as Request, mockResponse as Response, mockNext);
      middleware.use(request2 as Request, mockResponse as Response, mockNext);

      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('[req-1]'));
      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('[req-2]'));
    });
  });
});
