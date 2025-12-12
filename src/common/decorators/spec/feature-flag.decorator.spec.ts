import 'reflect-metadata';
import { SetMetadata } from '@nestjs/common';
import { FEATURE_FLAG_KEY, RequireFeature } from '../feature-flag.decorator';

// Mock SetMetadata
jest.mock('@nestjs/common', () => ({
  SetMetadata: jest.fn((key: string, value: any) => {
    return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
      if (propertyKey) {
        // For method decorators, store metadata on the target and propertyKey
        Reflect.defineMetadata(key, value, target, propertyKey);
      } else {
        // For class decorators, store metadata on the target
        Reflect.defineMetadata(key, value, target);
      }
      return descriptor || target;
    };
  }),
}));

describe('FeatureFlag Decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('FEATURE_FLAG_KEY', () => {
    it('should be defined', () => {
      expect(FEATURE_FLAG_KEY).toBeDefined();
    });

    it('should have the correct value', () => {
      expect(FEATURE_FLAG_KEY).toBe('featureFlag');
    });

    it('should be a string', () => {
      expect(typeof FEATURE_FLAG_KEY).toBe('string');
    });
  });

  describe('RequireFeature', () => {
    it('should be defined', () => {
      expect(RequireFeature).toBeDefined();
    });

    it('should be a function', () => {
      expect(typeof RequireFeature).toBe('function');
    });

    it('should call SetMetadata with FEATURE_FLAG_KEY and the provided flag', () => {
      const flag = 'test-feature';

      RequireFeature(flag);

      expect(SetMetadata).toHaveBeenCalledWith(FEATURE_FLAG_KEY, flag);
    });

    it('should call SetMetadata with correct key for different flags', () => {
      const flag1 = 'feature-one';
      const flag2 = 'feature-two';

      RequireFeature(flag1);
      RequireFeature(flag2);

      expect(SetMetadata).toHaveBeenCalledWith(FEATURE_FLAG_KEY, flag1);
      expect(SetMetadata).toHaveBeenCalledWith(FEATURE_FLAG_KEY, flag2);
      expect(SetMetadata).toHaveBeenCalledTimes(2);
    });

    it('should return a decorator function', () => {
      const flag = 'test-feature';
      const decorator = RequireFeature(flag);

      expect(typeof decorator).toBe('function');
    });

    it('should work with class decorators', () => {
      const flag = 'class-feature';

      @RequireFeature(flag)
      class TestClass {}

      const metadata = Reflect.getMetadata(FEATURE_FLAG_KEY, TestClass);
      expect(metadata).toBe(flag);
    });

    it('should work with method decorators', () => {
      const flag = 'method-feature';

      class TestClass {
        @RequireFeature(flag)
        testMethod() {}
      }

      const metadata = Reflect.getMetadata(FEATURE_FLAG_KEY, TestClass.prototype, 'testMethod');
      expect(metadata).toBe(flag);
    });

    it('should handle empty string flag', () => {
      const flag = '';

      RequireFeature(flag);

      expect(SetMetadata).toHaveBeenCalledWith(FEATURE_FLAG_KEY, flag);
    });

    it('should handle flag with special characters', () => {
      const flag = 'feature-flag_v2.0';

      RequireFeature(flag);

      expect(SetMetadata).toHaveBeenCalledWith(FEATURE_FLAG_KEY, flag);
    });

    it('should handle flag with numbers', () => {
      const flag = 'feature123';

      RequireFeature(flag);

      expect(SetMetadata).toHaveBeenCalledWith(FEATURE_FLAG_KEY, flag);
    });

    it('should handle flag with uppercase letters', () => {
      const flag = 'FEATURE_FLAG';

      RequireFeature(flag);

      expect(SetMetadata).toHaveBeenCalledWith(FEATURE_FLAG_KEY, flag);
    });

    it('should handle flag with mixed case', () => {
      const flag = 'FeatureFlag';

      RequireFeature(flag);

      expect(SetMetadata).toHaveBeenCalledWith(FEATURE_FLAG_KEY, flag);
    });

    it('should be callable multiple times with different flags', () => {
      const flags = ['flag1', 'flag2', 'flag3'];

      flags.forEach((flag) => RequireFeature(flag));

      expect(SetMetadata).toHaveBeenCalledTimes(3);
      flags.forEach((flag) => {
        expect(SetMetadata).toHaveBeenCalledWith(FEATURE_FLAG_KEY, flag);
      });
    });

    it('should maintain consistency across multiple invocations', () => {
      const flag = 'consistent-feature';

      const decorator1 = RequireFeature(flag);
      const decorator2 = RequireFeature(flag);

      expect(SetMetadata).toHaveBeenCalledWith(FEATURE_FLAG_KEY, flag);
      expect(SetMetadata).toHaveBeenCalledTimes(2);
    });

    it('should work with long flag names', () => {
      const flag = 'very-long-feature-flag-name-with-many-words-separated-by-hyphens';

      RequireFeature(flag);

      expect(SetMetadata).toHaveBeenCalledWith(FEATURE_FLAG_KEY, flag);
    });

    it('should preserve the original flag value', () => {
      const flag = 'original-flag';

      RequireFeature(flag);

      const calls = (SetMetadata as jest.Mock).mock.calls;
      expect(calls[calls.length - 1][1]).toBe(flag);
    });

    it('should set metadata on multiple methods in the same class', () => {
      const flag1 = 'method1-feature';
      const flag2 = 'method2-feature';

      class TestClass {
        @RequireFeature(flag1)
        method1() {}

        @RequireFeature(flag2)
        method2() {}
      }

      const metadata1 = Reflect.getMetadata(FEATURE_FLAG_KEY, TestClass.prototype, 'method1');
      const metadata2 = Reflect.getMetadata(FEATURE_FLAG_KEY, TestClass.prototype, 'method2');

      expect(metadata1).toBe(flag1);
      expect(metadata2).toBe(flag2);
    });

    it('should set metadata on both class and method', () => {
      const classFlag = 'class-feature';
      const methodFlag = 'method-feature';

      @RequireFeature(classFlag)
      class TestClass {
        @RequireFeature(methodFlag)
        testMethod() {}
      }

      const classMetadata = Reflect.getMetadata(FEATURE_FLAG_KEY, TestClass);
      const methodMetadata = Reflect.getMetadata(FEATURE_FLAG_KEY, TestClass.prototype, 'testMethod');

      expect(classMetadata).toBe(classFlag);
      expect(methodMetadata).toBe(methodFlag);
    });
  });

  describe('Integration', () => {
    it('should use the correct key constant', () => {
      const flag = 'integration-test';

      RequireFeature(flag);

      expect(SetMetadata).toHaveBeenCalledWith('featureFlag', flag);
    });

    it('should maintain the relationship between key and decorator', () => {
      const flag = 'relationship-test';

      class TestClass {
        @RequireFeature(flag)
        testMethod() {}
      }

      const metadata = Reflect.getMetadata(FEATURE_FLAG_KEY, TestClass.prototype, 'testMethod');

      expect(metadata).toBe(flag);
      expect(FEATURE_FLAG_KEY).toBe('featureFlag');
    });
  });
});
