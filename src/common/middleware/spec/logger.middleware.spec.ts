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

  beforeEach(() => {
    middleware = new LoggerMiddleware();

    mockRequest = {
      method: 'GET',
      originalUrl: '/api/test',
      headers: {
        'user-agent': 'test-agent',
      },
      body: {},
    };

    mockResponse = {
      statusCode: 200,
      on: jest.fn(),
    };

    mockNext = jest.fn();

    // Spy on logger methods
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('use', () => {
    it('should log incoming request with requestId', () => {
      (mockRequest as Record<string, unknown>)['requestId'] = 'test-request-id';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerLogSpy).toHaveBeenCalledWith('[test-request-id] Incoming: GET /api/test - UserAgent: test-agent');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use "no-request-id" when requestId is not available', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerLogSpy).toHaveBeenCalledWith('[no-request-id] Incoming: GET /api/test - UserAgent: test-agent');
    });

    it('should use "unknown" for user-agent when not available', () => {
      mockRequest.headers = {};

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('UserAgent: unknown'));
    });

    it('should log request body when present', () => {
      (mockRequest as Record<string, unknown>)['requestId'] = 'test-request-id';
      mockRequest.body = { name: 'test', age: 25 };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).toHaveBeenCalledWith('[test-request-id] Body: {"name":"test","age":25}');
    });

    it('should not log body when empty', () => {
      mockRequest.body = {};

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).not.toHaveBeenCalled();
    });

    it('should sanitize sensitive fields in body', () => {
      (mockRequest as Record<string, unknown>)['requestId'] = 'test-request-id';
      mockRequest.body = {
        username: 'john',
        password: 'secret123',
        token: 'abc123',
      };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[test-request-id] Body: {"username":"john","password":"[REDACTED]","token":"[REDACTED]"}',
      );
    });

    it('should handle JSON.stringify errors', () => {
      (mockRequest as Record<string, unknown>)['requestId'] = 'test-request-id';

      // Create an object with a property that has a getter throwing an error
      const problematicBody: Record<string, unknown> = {
        name: 'test',
      };

      // Define a property with a getter that throws when accessed
      Object.defineProperty(problematicBody, 'problematicProp', {
        get() {
          throw new Error('Cannot access this property');
        },
        enumerable: true,
      });

      mockRequest.body = problematicBody;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[test-request-id] Body: [Unable to serialize - circular reference detected]',
      );
    });

    it('should handle objects with toJSON that throws', () => {
      (mockRequest as Record<string, unknown>)['requestId'] = 'test-request-id';

      const bodyWithBadToJSON = {
        name: 'test',
        toJSON() {
          throw new Error('toJSON error');
        },
      };

      mockRequest.body = bodyWithBadToJSON;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[test-request-id] Body: [Unable to serialize - circular reference detected]',
      );
    });

    it('should log successful response with 200 status', () => {
      const finishCallback = jest.fn();
      mockResponse.on = jest.fn((event, callback) => {
        if (event === 'finish') {
          finishCallback.mockImplementation(callback);
        }
        return mockResponse as Response;
      });
      mockResponse.statusCode = 200;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Completed: GET /api/test - Status: 200 - Duration:'),
      );
    });

    it('should log warning for 4xx status codes', () => {
      const finishCallback = jest.fn();
      mockResponse.on = jest.fn((event, callback) => {
        if (event === 'finish') {
          finishCallback.mockImplementation(callback);
        }
        return mockResponse as Response;
      });
      mockResponse.statusCode = 404;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Completed: GET /api/test - Status: 404 - Duration:'),
      );
    });

    it('should log error for 5xx status codes', () => {
      const finishCallback = jest.fn();
      mockResponse.on = jest.fn((event, callback) => {
        if (event === 'finish') {
          finishCallback.mockImplementation(callback);
        }
        return mockResponse as Response;
      });
      mockResponse.statusCode = 500;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Completed: GET /api/test - Status: 500 - Duration:'),
      );
    });

    it('should handle POST requests', () => {
      mockRequest.method = 'POST';
      mockRequest.originalUrl = '/api/users';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('Incoming: POST /api/users'));
    });

    it('should handle different status codes correctly - 400', () => {
      const finishCallback = jest.fn();
      mockResponse.on = jest.fn((event, callback) => {
        if (event === 'finish') {
          finishCallback.mockImplementation(callback);
        }
        return mockResponse as Response;
      });
      mockResponse.statusCode = 400;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('should handle different status codes correctly - 503', () => {
      const finishCallback = jest.fn();
      mockResponse.on = jest.fn((event, callback) => {
        if (event === 'finish') {
          finishCallback.mockImplementation(callback);
        }
        return mockResponse as Response;
      });
      mockResponse.statusCode = 503;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('should call next() to continue middleware chain', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('sanitizeBody', () => {
    it('should redact password field', () => {
      const body = { username: 'john', password: 'secret' };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({ username: 'john', password: '[REDACTED]' });
    });

    it('should redact token field', () => {
      const body = { data: 'test', token: 'abc123' };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({ data: 'test', token: '[REDACTED]' });
    });

    it('should redact secret field', () => {
      const body = { data: 'test', secret: 'mysecret' };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({ data: 'test', secret: '[REDACTED]' });
    });

    it('should redact authorization field', () => {
      const body = { data: 'test', authorization: 'Bearer token' };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({ data: 'test', authorization: '[REDACTED]' });
    });

    it('should redact creditCard field', () => {
      const body = { name: 'John', creditCard: '1234-5678-9012-3456' };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({ name: 'John', creditCard: '[REDACTED]' });
    });

    it('should redact cvv field', () => {
      const body = { name: 'John', cvv: '123' };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({ name: 'John', cvv: '[REDACTED]' });
    });

    it('should redact multiple sensitive fields', () => {
      const body = {
        username: 'john',
        password: 'secret',
        token: 'abc123',
        creditCard: '1234',
      };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({
        username: 'john',
        password: '[REDACTED]',
        token: '[REDACTED]',
        creditCard: '[REDACTED]',
      });
    });

    it('should sanitize nested objects', () => {
      const body = {
        user: {
          name: 'john',
          password: 'secret',
        },
        data: 'test',
      };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({
        user: {
          name: 'john',
          password: '[REDACTED]',
        },
        data: 'test',
      });
    });

    it('should handle deeply nested objects', () => {
      const body = {
        level1: {
          level2: {
            level3: {
              password: 'secret',
              name: 'test',
            },
          },
        },
      };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              password: '[REDACTED]',
              name: 'test',
            },
          },
        },
      });
    });

    it('should handle circular references', () => {
      const body: Record<string, unknown> = { name: 'test' };
      body.self = body;

      const result = middleware['sanitizeBody'](body);

      expect(result.name).toBe('test');
      expect(result.self).toEqual({ '[Circular]': true });
    });

    it('should handle circular references in nested objects', () => {
      const nested: Record<string, unknown> = { value: 'nested' };
      nested.circular = nested;
      const body: Record<string, unknown> = {
        name: 'test',
        nested,
      };

      const result = middleware['sanitizeBody'](body);

      expect(result.name).toBe('test');
      expect((result.nested as Record<string, unknown>).value).toBe('nested');
      expect((result.nested as Record<string, unknown>).circular).toEqual({ '[Circular]': true });
    });

    it('should not modify arrays', () => {
      const body = {
        name: 'test',
        tags: ['tag1', 'tag2'],
      };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({
        name: 'test',
        tags: ['tag1', 'tag2'],
      });
    });

    it('should handle null values', () => {
      const body = {
        name: 'test',
        value: null,
      };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({
        name: 'test',
        value: null,
      });
    });

    it('should handle undefined values', () => {
      const body = {
        name: 'test',
        value: undefined,
      };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({
        name: 'test',
        value: undefined,
      });
    });

    it('should preserve non-sensitive nested fields', () => {
      const body = {
        user: {
          id: 1,
          email: 'test@example.com',
          profile: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual(body);
    });

    it('should handle empty objects', () => {
      const body = {};
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({});
    });

    it('should handle objects with only sensitive fields', () => {
      const body = {
        password: 'secret',
        token: 'abc123',
      };
      const result = middleware['sanitizeBody'](body);

      expect(result).toEqual({
        password: '[REDACTED]',
        token: '[REDACTED]',
      });
    });
  });
});
