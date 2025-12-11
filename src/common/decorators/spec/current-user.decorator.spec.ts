import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { AuthenticatedUser } from '../../../interfaces/jwt-payload.interface';

// Import the decorator factory function directly
import { CurrentUser } from '../current-user.decorator';

describe('CurrentUser Decorator', () => {
  let mockExecutionContext: ExecutionContext;
  let mockRequest: any;

  // Helper function to extract the factory function from the decorator
  function getParamDecoratorFactory(decorator: Function) {
    class TestDecorator {
      public test(@decorator() value: any) {}
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestDecorator, 'test');
    return args[Object.keys(args)[0]].factory;
  }

  beforeEach(() => {
    mockRequest = {
      user: null,
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getType: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when user is not present in request', () => {
    it('should return null when user is not in request', () => {
      mockRequest.user = null;
      const factory = getParamDecoratorFactory(CurrentUser);

      const result = factory(undefined, mockExecutionContext);

      expect(result).toBeNull();
    });

    it('should return null when user is undefined', () => {
      mockRequest.user = undefined;
      const factory = getParamDecoratorFactory(CurrentUser);

      const result = factory(undefined, mockExecutionContext);

      expect(result).toBeNull();
    });

    it('should call switchToHttp when user is null', () => {
      mockRequest.user = null;
      const factory = getParamDecoratorFactory(CurrentUser);

      factory(undefined, mockExecutionContext);

      expect(mockExecutionContext.switchToHttp).toHaveBeenCalled();
    });
  });

  describe('when user is present in request', () => {
    let mockUser: AuthenticatedUser;

    beforeEach(() => {
      mockUser = {
        userId: '123',
        email: 'test@example.com',
        role: 'admin',
      } as AuthenticatedUser;

      mockRequest.user = mockUser;
    });

    it('should return entire user object when no data parameter is provided', () => {
      const factory = getParamDecoratorFactory(CurrentUser);

      const result = factory(undefined, mockExecutionContext);

      expect(result).toEqual(mockUser);
    });

    it('should return entire user object when data is undefined', () => {
      const factory = getParamDecoratorFactory(CurrentUser);

      const result = factory(undefined, mockExecutionContext);

      expect(result).toBe(mockUser);
      expect(result.userId).toBe('123');
      expect(result.email).toBe('test@example.com');
    });

    it('should return specific property when data parameter is provided', () => {
      const factory = getParamDecoratorFactory(CurrentUser);

      const result = factory('userId', mockExecutionContext);

      expect(result).toBe('123');
    });

    it('should return email when data parameter is "email"', () => {
      const factory = getParamDecoratorFactory(CurrentUser);

      const result = factory('email', mockExecutionContext);

      expect(result).toBe('test@example.com');
    });

    it('should return role when data parameter is "role"', () => {
      const factory = getParamDecoratorFactory(CurrentUser);

      const result = factory('role', mockExecutionContext);

      expect(result).toBe('admin');
    });

    it('should call switchToHttp on ExecutionContext', () => {
      const factory = getParamDecoratorFactory(CurrentUser);

      factory(undefined, mockExecutionContext);

      expect(mockExecutionContext.switchToHttp).toHaveBeenCalledTimes(1);
    });

    it('should call getRequest on http context', () => {
      const factory = getParamDecoratorFactory(CurrentUser);
      const switchToHttpMock = mockExecutionContext.switchToHttp();

      factory(undefined, mockExecutionContext);

      expect(switchToHttpMock.getRequest).toHaveBeenCalled();
    });

    it('should handle multiple properties correctly', () => {
      const factory = getParamDecoratorFactory(CurrentUser);

      const userId = factory('userId', mockExecutionContext);
      const email = factory('email', mockExecutionContext);

      expect(userId).toBe('123');
      expect(email).toBe('test@example.com');
    });
  });

  describe('decorator creation', () => {
    it('should create a parameter decorator', () => {
      expect(CurrentUser).toBeDefined();
      expect(typeof CurrentUser).toBe('function');
    });

    it('should be able to extract factory function', () => {
      const factory = getParamDecoratorFactory(CurrentUser);
      expect(factory).toBeDefined();
      expect(typeof factory).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle user with missing properties gracefully', () => {
      mockRequest.user = { userId: '456' } as AuthenticatedUser;
      const factory = getParamDecoratorFactory(CurrentUser);

      const result = factory('email', mockExecutionContext);

      expect(result).toBeUndefined();
    });

    it('should return null for falsy user values', () => {
      mockRequest.user = null;
      const factory = getParamDecoratorFactory(CurrentUser);

      const result = factory('userId', mockExecutionContext);

      expect(result).toBeNull();
    });

    it('should handle empty user object', () => {
      mockRequest.user = {} as AuthenticatedUser;
      const factory = getParamDecoratorFactory(CurrentUser);

      const result = factory(undefined, mockExecutionContext);

      expect(result).toEqual({});
    });

    it('should prioritize data parameter over undefined', () => {
      mockRequest.user = {
        userId: '789',
        email: 'another@example.com',
      } as AuthenticatedUser;
      const factory = getParamDecoratorFactory(CurrentUser);

      const resultWithData = factory('userId', mockExecutionContext);
      const resultWithoutData = factory(undefined, mockExecutionContext);

      expect(resultWithData).toBe('789');
      expect(resultWithoutData).toEqual(mockRequest.user);
    });

    it('should handle complex user objects', () => {
      mockRequest.user = {
        userId: '999',
        email: 'complex@example.com',
        role: 'superadmin',
        additionalData: { nested: 'value' },
      } as any;
      const factory = getParamDecoratorFactory(CurrentUser);

      const result = factory(undefined, mockExecutionContext);

      expect(result).toEqual(mockRequest.user);
      expect(result.additionalData).toEqual({ nested: 'value' });
    });
  });

  describe('execution context handling', () => {
    it('should properly extract request from execution context', () => {
      mockRequest.user = { userId: '111' } as AuthenticatedUser;
      const factory = getParamDecoratorFactory(CurrentUser);

      factory(undefined, mockExecutionContext);

      expect(mockExecutionContext.switchToHttp).toHaveBeenCalled();
      const httpContext = mockExecutionContext.switchToHttp();
      expect(httpContext.getRequest).toBeDefined();
    });

    it('should work with different execution contexts', () => {
      const alternativeMockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { userId: '222', email: 'alt@example.com' } as AuthenticatedUser,
          }),
        }),
        getClass: jest.fn(),
        getHandler: jest.fn(),
        getType: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
      } as any;
      const factory = getParamDecoratorFactory(CurrentUser);

      const result = factory(undefined, alternativeMockContext);

      expect(result.userId).toBe('222');
      expect(result.email).toBe('alt@example.com');
    });
  });
});
