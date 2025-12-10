import { Reflector } from '@nestjs/core';
import { FeatureFlagGuard } from '../feature-flag.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { FEATURE_FLAG_KEY } from '../../decorators/feature-flag.decorator';

describe('FeatureFlagGuard', () => {
  let guard: FeatureFlagGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new FeatureFlagGuard(reflector);
  });

  describe('canActivate', () => {
    it('should return true when no feature flag is required', () => {
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn(),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(FEATURE_FLAG_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('should return true when feature flag is enabled', () => {
      const mockRequest = {
        requestId: 'test-request-id',
        tenantContext: { tenantId: 'tenant-123' },
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('new-dashboard');

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when feature flag is disabled', () => {
      const mockRequest = {
        requestId: 'test-request-id',
        tenantContext: { tenantId: 'tenant-123' },
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('disabled-feature');

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);

      try {
        guard.canActivate(mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.getResponse()).toEqual({
          message: 'Feature not available',
          code: 'FEATURE_DISABLED',
          feature: 'disabled-feature',
          requestId: 'test-request-id',
        });
      }
    });

    it('should use "no-request-id" when requestId is not present', () => {
      const mockRequest = {
        tenantContext: { tenantId: 'tenant-123' },
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('disabled-feature');

      try {
        guard.canActivate(mockContext);
      } catch (error) {
        expect(error.getResponse()).toEqual({
          message: 'Feature not available',
          code: 'FEATURE_DISABLED',
          feature: 'disabled-feature',
          requestId: 'no-request-id',
        });
      }
    });

    it('should handle missing tenantContext', () => {
      const mockRequest = {
        requestId: 'test-request-id',
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('new-dashboard');

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle tenantContext with undefined tenantId', () => {
      const mockRequest = {
        requestId: 'test-request-id',
        tenantContext: {},
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('new-dashboard');

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return true for beta-reports feature flag', () => {
      const mockRequest = {
        requestId: 'test-request-id',
        tenantContext: { tenantId: 'tenant-456' },
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('beta-reports');

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle null as requiredFlag', () => {
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn(),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle empty string requestId', () => {
      const mockRequest = {
        requestId: '',
        tenantContext: { tenantId: 'tenant-123' },
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('disabled-feature');

      try {
        guard.canActivate(mockContext);
      } catch (error) {
        expect(error.getResponse()).toEqual({
          message: 'Feature not available',
          code: 'FEATURE_DISABLED',
          feature: 'disabled-feature',
          requestId: 'no-request-id',
        });
      }
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled features', () => {
      const result = guard['isFeatureEnabled']('new-dashboard', 'tenant-123');

      expect(result).toBe(true);
    });

    it('should return false for disabled features', () => {
      const result = guard['isFeatureEnabled']('non-existent-feature', 'tenant-123');

      expect(result).toBe(false);
    });

    it('should handle undefined tenantId', () => {
      const result = guard['isFeatureEnabled']('new-dashboard', undefined);

      expect(result).toBe(true);
    });

    it('should handle empty string tenantId', () => {
      const result = guard['isFeatureEnabled']('new-dashboard', '');

      expect(result).toBe(true);
    });
  });

  describe('isFeatureEnabled - tenant-specific logic', () => {
    it('should return false for beta-reports when tenantId is tenant-123', () => {
      const result = guard['isFeatureEnabled']('beta-reports', 'tenant-123');

      expect(result).toBe(false);
    });

    it('should return true for beta-reports when tenantId is not tenant-123', () => {
      const result = guard['isFeatureEnabled']('beta-reports', 'tenant-456');

      expect(result).toBe(true);
    });

    it('should return true for beta-reports when tenantId is undefined', () => {
      const result = guard['isFeatureEnabled']('beta-reports', undefined);

      expect(result).toBe(true);
    });

    it('should return true for new-dashboard regardless of tenantId', () => {
      const result = guard['isFeatureEnabled']('new-dashboard', 'tenant-123');

      expect(result).toBe(true);
    });

    it('should return false when feature is not in enabledFeatures set', () => {
      const result = guard['isFeatureEnabled']('unknown-feature', 'tenant-123');

      expect(result).toBe(false);
    });

    it('should return false when feature is not in enabledFeatures set without tenantId', () => {
      const result = guard['isFeatureEnabled']('unknown-feature', undefined);

      expect(result).toBe(false);
    });

    it('should return true for enabled feature with no tenant-specific restrictions', () => {
      const result = guard['isFeatureEnabled']('new-dashboard', 'any-tenant');

      expect(result).toBe(true);
    });

    it('should handle feature flag that exists in disabledForTenants but tenant does not match', () => {
      const result = guard['isFeatureEnabled']('beta-reports', 'tenant-999');

      expect(result).toBe(true);
    });

    it('should handle empty string as tenantId for beta-reports', () => {
      const result = guard['isFeatureEnabled']('beta-reports', '');

      expect(result).toBe(true);
    });
  });

  describe('canActivate - tenant-specific restrictions', () => {
    it('should throw ForbiddenException for beta-reports when tenantId is tenant-123', () => {
      const mockRequest = {
        requestId: 'test-request-id',
        tenantContext: { tenantId: 'tenant-123' },
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('beta-reports');

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);

      try {
        guard.canActivate(mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.getResponse()).toEqual({
          message: 'Feature not available',
          code: 'FEATURE_DISABLED',
          feature: 'beta-reports',
          requestId: 'test-request-id',
        });
      }
    });

    it('should return true for beta-reports when tenantId is not tenant-123', () => {
      const mockRequest = {
        requestId: 'test-request-id',
        tenantContext: { tenantId: 'tenant-456' },
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('beta-reports');

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return true for new-dashboard with tenant-123', () => {
      const mockRequest = {
        requestId: 'test-request-id',
        tenantContext: { tenantId: 'tenant-123' },
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('new-dashboard');

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle beta-reports with no tenantContext', () => {
      const mockRequest = {
        requestId: 'test-request-id',
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('beta-reports');

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle empty string tenantId with beta-reports', () => {
      const mockRequest = {
        requestId: 'test-request-id',
        tenantContext: { tenantId: '' },
      };

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('beta-reports');

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });
});
