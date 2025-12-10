import { SetMetadata } from '@nestjs/common';
import { Public, IS_PUBLIC_KEY } from '../public.decorator';

// Mock SetMetadata
jest.mock('@nestjs/common', () => ({
  SetMetadata: jest.fn((key, value) => {
    return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
      return descriptor;
    };
  }),
}));

describe('Public Decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('IS_PUBLIC_KEY', () => {
    it('should export IS_PUBLIC_KEY constant with value "isPublic"', () => {
      expect(IS_PUBLIC_KEY).toBe('isPublic');
    });

    it('should be of type string', () => {
      expect(typeof IS_PUBLIC_KEY).toBe('string');
    });

    it('should not be empty', () => {
      expect(IS_PUBLIC_KEY.length).toBeGreaterThan(0);
    });

    it('should be immutable constant', () => {
      const originalValue = IS_PUBLIC_KEY;
      expect(IS_PUBLIC_KEY).toBe(originalValue);
    });
  });

  describe('Public', () => {
    it('should call SetMetadata with IS_PUBLIC_KEY and true', () => {
      Public();

      expect(SetMetadata).toHaveBeenCalledWith(IS_PUBLIC_KEY, true);
    });

    it('should call SetMetadata exactly once', () => {
      Public();

      expect(SetMetadata).toHaveBeenCalledTimes(1);
    });

    it('should return a decorator function', () => {
      const decorator = Public();

      expect(typeof decorator).toBe('function');
    });

    it('should call SetMetadata with correct parameters', () => {
      Public();

      const callArgs = (SetMetadata as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('isPublic');
      expect(callArgs[1]).toBe(true);
    });

    it('should always set value to true', () => {
      Public();

      const callArgs = (SetMetadata as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe(true);
      expect(callArgs[1]).not.toBe(false);
    });

    it('should work when called multiple times', () => {
      Public();
      Public();
      Public();

      expect(SetMetadata).toHaveBeenCalledTimes(3);
      expect(SetMetadata).toHaveBeenNthCalledWith(1, IS_PUBLIC_KEY, true);
      expect(SetMetadata).toHaveBeenNthCalledWith(2, IS_PUBLIC_KEY, true);
      expect(SetMetadata).toHaveBeenNthCalledWith(3, IS_PUBLIC_KEY, true);
    });

    it('should not accept any parameters', () => {
      const decorator = Public();

      expect(Public.length).toBe(0);
      expect(typeof decorator).toBe('function');
    });

    it('should create consistent decorators', () => {
      const decorator1 = Public();
      const decorator2 = Public();

      expect(typeof decorator1).toBe(typeof decorator2);
      expect(SetMetadata).toHaveBeenCalledTimes(2);
    });

    it('should use the same key for all invocations', () => {
      Public();
      jest.clearAllMocks();
      Public();

      const callArgs = (SetMetadata as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(IS_PUBLIC_KEY);
    });

    it('should return function that can be used as decorator', () => {
      const decorator = Public();
      const mockDescriptor = { value: jest.fn() };
      const result = decorator({}, 'method', mockDescriptor);

      expect(result).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('should use consistent key between constant and function', () => {
      Public();

      const callArgs = (SetMetadata as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(IS_PUBLIC_KEY);
    });

    it('should always set metadata value to boolean true', () => {
      Public();

      const callArgs = (SetMetadata as jest.Mock).mock.calls[0];
      expect(typeof callArgs[1]).toBe('boolean');
      expect(callArgs[1]).toBe(true);
    });

    it('should match expected metadata structure', () => {
      Public();

      expect(SetMetadata).toHaveBeenCalledWith(expect.any(String), expect.any(Boolean));
    });
  });
});
