import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance of JwtAuthGuard', () => {
      expect(guard).toBeDefined();
      expect(guard).toBeInstanceOf(JwtAuthGuard);
    });

    it('should call super constructor when instantiated', () => {
      const newReflector = {
        getAllAndOverride: jest.fn(),
      } as any;

      const newGuard = new JwtAuthGuard(newReflector);

      expect(newGuard).toBeDefined();
      expect(newGuard).toBeInstanceOf(JwtAuthGuard);
    });
  });

  describe('canActivate', () => {
    let mockContext: ExecutionContext;

    beforeEach(() => {
      mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn(),
      } as any;
    });

    it('should return true for public routes', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('should call super.canActivate for protected routes', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const superCanActivateSpy = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
    });

    it('should return true when isPublic is explicitly true', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should check metadata on both handler and class', () => {
      const handler = jest.fn();
      const classRef = jest.fn();
      mockContext.getHandler = jest.fn().mockReturnValue(handler);
      mockContext.getClass = jest.fn().mockReturnValue(classRef);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate').mockReturnValue(true);

      void guard.canActivate(mockContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [handler, classRef]);
    });

    describe('canActivate - additional edge cases', () => {
      let mockContext: ExecutionContext;

      beforeEach(() => {
        mockContext = {
          getHandler: jest.fn(),
          getClass: jest.fn(),
          switchToHttp: jest.fn(),
        } as any;
      });

      it('should handle when isPublic is false (falsy check)', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
        jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate').mockReturnValue(true);

        void guard.canActivate(mockContext);

        expect(reflector.getAllAndOverride).toHaveBeenCalled();
      });

      it('should handle when isPublic is undefined', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
        jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate').mockReturnValue(true);

        void guard.canActivate(mockContext);

        expect(reflector.getAllAndOverride).toHaveBeenCalled();
      });

      it('should handle when isPublic is null', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
        jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate').mockReturnValue(true);

        void guard.canActivate(mockContext);

        expect(reflector.getAllAndOverride).toHaveBeenCalled();
      });

      it('should return promise when super.canActivate returns promise', async () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
        jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate').mockReturnValue(Promise.resolve(true));

        const result = guard.canActivate(mockContext);

        expect(result).toBeInstanceOf(Promise);
        await expect(result).resolves.toBe(true);
      });

      it('should return observable when super.canActivate returns observable', (done) => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
        const observable = new Observable((subscriber) => {
          subscriber.next(true);
          subscriber.complete();
        });
        jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate').mockReturnValue(observable);

        const result = guard.canActivate(mockContext);

        expect(result).toBeInstanceOf(Observable);
        if (result instanceof Observable) {
          result.subscribe({
            next: (value: boolean) => {
              expect(value).toBe(true);
              done();
            },
          });
        }
      });
    });
  });

  describe('handleRequest', () => {
    let mockContext: ExecutionContext;
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        requestId: 'test-request-id-123',
      };

      mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as any;
    });

    it('should return user when authentication is successful', () => {
      const mockUser = { id: 1, email: 'test@example.com' };

      const result = guard.handleRequest(null, mockUser, null, mockContext);

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException with TOKEN_EXPIRED when token is expired', () => {
      const tokenExpiredError = new TokenExpiredError('jwt expired', new Date());

      expect(() => guard.handleRequest(null, null, tokenExpiredError, mockContext)).toThrow(UnauthorizedException);

      try {
        guard.handleRequest(null, null, tokenExpiredError, mockContext);
      } catch (error) {
        expect(error.message).toBe('Token has expired');
        expect(error.response).toEqual({
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED',
          requestId: 'test-request-id-123',
        });
      }
    });

    it('should throw UnauthorizedException with INVALID_TOKEN for JsonWebTokenError', () => {
      const jwtError = new JsonWebTokenError('invalid token');

      expect(() => guard.handleRequest(null, null, jwtError, mockContext)).toThrow(UnauthorizedException);

      try {
        guard.handleRequest(null, null, jwtError, mockContext);
      } catch (error) {
        expect(error.message).toBe('Invalid token');
        expect(error.response).toEqual({
          message: 'Invalid token',
          code: 'INVALID_TOKEN',
          requestId: 'test-request-id-123',
        });
      }
    });

    it('should throw UnauthorizedException with TOKEN_MISSING when no auth token', () => {
      const noTokenError = new Error('No auth token');

      expect(() => guard.handleRequest(null, null, noTokenError, mockContext)).toThrow(UnauthorizedException);

      try {
        guard.handleRequest(null, null, noTokenError, mockContext);
      } catch (error) {
        expect(error.message).toBe('Authentication token is required');
        expect(error.response).toEqual({
          message: 'Authentication token is required',
          code: 'TOKEN_MISSING',
          requestId: 'test-request-id-123',
        });
      }
    });

    it('should throw UnauthorizedException with UNAUTHORIZED when err is provided', () => {
      const mockError = new Error('Some error');
      const mockUser = { id: 1, email: 'test@example.com' };

      expect(() => guard.handleRequest(mockError, mockUser, null, mockContext)).toThrow(UnauthorizedException);

      try {
        guard.handleRequest(mockError, mockUser, null, mockContext);
      } catch (error) {
        expect(error.message).toBe('Unauthorized access');
        expect(error.response).toEqual({
          message: 'Unauthorized access',
          code: 'UNAUTHORIZED',
          requestId: 'test-request-id-123',
        });
      }
    });

    it('should throw UnauthorizedException with UNAUTHORIZED when user is null', () => {
      expect(() => guard.handleRequest(null, null, null, mockContext)).toThrow(UnauthorizedException);

      try {
        guard.handleRequest(null, null, null, mockContext);
      } catch (error) {
        expect(error.message).toBe('Unauthorized access');
        expect(error.response).toEqual({
          message: 'Unauthorized access',
          code: 'UNAUTHORIZED',
          requestId: 'test-request-id-123',
        });
      }
    });

    it('should throw UnauthorizedException with UNAUTHORIZED when user is undefined', () => {
      expect(() => guard.handleRequest(null, undefined, null, mockContext)).toThrow(UnauthorizedException);

      try {
        guard.handleRequest(null, undefined, null, mockContext);
      } catch (error) {
        expect(error.message).toBe('Unauthorized access');
        expect(error.response).toEqual({
          message: 'Unauthorized access',
          code: 'UNAUTHORIZED',
          requestId: 'test-request-id-123',
        });
      }
    });

    it('should use "no-request-id" when requestId is not available', () => {
      mockRequest.requestId = undefined;

      try {
        guard.handleRequest(null, null, null, mockContext);
      } catch (error) {
        expect(error.response.requestId).toBe('no-request-id');
      }
    });

    it('should use "no-request-id" when requestId is null', () => {
      mockRequest.requestId = null;

      try {
        guard.handleRequest(null, null, null, mockContext);
      } catch (error) {
        expect(error.response.requestId).toBe('no-request-id');
      }
    });

    it('should prioritize TokenExpiredError over other conditions', () => {
      const tokenExpiredError = new TokenExpiredError('jwt expired', new Date());
      const mockUser = { id: 1, email: 'test@example.com' };

      try {
        guard.handleRequest(null, mockUser, tokenExpiredError, mockContext);
      } catch (error) {
        expect(error.response.code).toBe('TOKEN_EXPIRED');
      }
    });

    it('should prioritize JsonWebTokenError over generic errors', () => {
      const jwtError = new JsonWebTokenError('malformed jwt');
      const mockUser = { id: 1, email: 'test@example.com' };

      try {
        guard.handleRequest(null, mockUser, jwtError, mockContext);
      } catch (error) {
        expect(error.response.code).toBe('INVALID_TOKEN');
      }
    });

    it('should prioritize "No auth token" message over generic unauthorized', () => {
      const noTokenError = new Error('No auth token');
      const mockUser = { id: 1, email: 'test@example.com' };

      try {
        guard.handleRequest(null, mockUser, noTokenError, mockContext);
      } catch (error) {
        expect(error.response.code).toBe('TOKEN_MISSING');
      }
    });

    it('should handle info with different error message gracefully', () => {
      const genericError = new Error('Some other error');
      const mockUser = { id: 1, email: 'test@example.com' };

      const result = guard.handleRequest(null, mockUser, genericError, mockContext);

      expect(result).toEqual(mockUser);
    });

    it('should return user when err is null and user exists', () => {
      const mockUser = { id: 1, email: 'test@example.com', role: 'admin' };

      const result = guard.handleRequest(null, mockUser, null, mockContext);

      expect(result).toEqual(mockUser);
    });

    it('should handle both err and no user condition', () => {
      const mockError = new Error('Authentication failed');

      try {
        guard.handleRequest(mockError, null, null, mockContext);
      } catch (error) {
        expect(error.response.code).toBe('UNAUTHORIZED');
        expect(error.response.message).toBe('Unauthorized access');
      }
    });

    it('should extract requestId from request object', () => {
      mockRequest.requestId = 'custom-id-456';

      try {
        guard.handleRequest(null, null, null, mockContext);
      } catch (error) {
        expect(error.response.requestId).toBe('custom-id-456');
      }
    });

    it('should handle empty string requestId', () => {
      mockRequest.requestId = '';

      try {
        guard.handleRequest(null, null, null, mockContext);
      } catch (error) {
        expect(error.response.requestId).toBe('no-request-id');
      }
    });

    it('should return user with all properties intact', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        role: 'admin',
        permissions: ['read', 'write'],
        metadata: { createdAt: '2024-01-01' },
      };

      const result = guard.handleRequest(null, mockUser, null, mockContext);

      expect(result).toEqual(mockUser);
      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('role', 'admin');
      expect(result).toHaveProperty('permissions');
      expect(result).toHaveProperty('metadata');
    });

    describe('handleRequest - additional edge cases', () => {
      let mockContext: ExecutionContext;
      let mockRequest: any;

      beforeEach(() => {
        mockRequest = {
          requestId: 'test-request-id-123',
        };

        mockContext = {
          switchToHttp: jest.fn().mockReturnValue({
            getRequest: jest.fn().mockReturnValue(mockRequest),
          }),
        } as any;
      });

      it('should handle when info is null and user exists', () => {
        const mockUser = { id: 1, email: 'test@example.com' };

        const result = guard.handleRequest(null, mockUser, null, mockContext);

        expect(result).toEqual(mockUser);
      });

      it('should handle when request object does not have requestId property', () => {
        const mockRequestWithoutId = {};
        const mockContextWithoutId = {
          switchToHttp: jest.fn().mockReturnValue({
            getRequest: jest.fn().mockReturnValue(mockRequestWithoutId),
          }),
        } as any;

        try {
          guard.handleRequest(null, null, null, mockContextWithoutId);
        } catch (error) {
          expect(error.response.requestId).toBe('no-request-id');
        }
      });

      it('should handle user with falsy values (0, false, empty string) as valid', () => {
        const mockUserWithZero = { id: 0, active: false, name: '' };

        const result = guard.handleRequest(null, mockUserWithZero, null, mockContext);

        expect(result).toEqual(mockUserWithZero);
      });

      it('should throw UNAUTHORIZED when user is explicitly false', () => {
        try {
          guard.handleRequest(null, false as any, null, mockContext);
        } catch (error) {
          expect(error.response.code).toBe('UNAUTHORIZED');
        }
      });

      it('should throw UNAUTHORIZED when user is empty string', () => {
        try {
          guard.handleRequest(null, '' as any, null, mockContext);
        } catch (error) {
          expect(error.response.code).toBe('UNAUTHORIZED');
        }
      });

      it('should throw UNAUTHORIZED when user is 0', () => {
        try {
          guard.handleRequest(null, 0 as any, null, mockContext);
        } catch (error) {
          expect(error.response.code).toBe('UNAUTHORIZED');
        }
      });

      it('should handle JsonWebTokenError with different messages', () => {
        const jwtErrors = [
          new JsonWebTokenError('jwt malformed'),
          new JsonWebTokenError('jwt signature is required'),
          new JsonWebTokenError('invalid signature'),
        ];

        jwtErrors.forEach((jwtError) => {
          try {
            guard.handleRequest(null, null, jwtError, mockContext);
          } catch (error) {
            expect(error.response.code).toBe('INVALID_TOKEN');
          }
        });
      });

      it('should handle error instance with custom properties', () => {
        const customError = new Error('Custom auth error');
        (customError as any).statusCode = 401;
        (customError as any).customProperty = 'test';

        try {
          guard.handleRequest(customError, null, null, mockContext);
        } catch (error) {
          expect(error.response.code).toBe('UNAUTHORIZED');
        }
      });

      it('should handle info error with case-sensitive message check', () => {
        const wrongCaseError = new Error('no auth token'); // lowercase
        const mockUser = { id: 1, email: 'test@example.com' };

        const result = guard.handleRequest(null, mockUser, wrongCaseError, mockContext);

        expect(result).toEqual(mockUser);
      });

      it('should handle info error with partial message match', () => {
        const partialError = new Error('No auth');
        const mockUser = { id: 1, email: 'test@example.com' };

        const result = guard.handleRequest(null, mockUser, partialError, mockContext);

        expect(result).toEqual(mockUser);
      });
    });
  });
});
