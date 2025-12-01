import { BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextMiddleware } from '../tenant-context.middleware';

describe('TenantContextMiddleware', () => {
  let middleware: TenantContextMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  const originalEnv = process.env.DEFAULT_TENANT_ID;

  beforeEach(() => {
    middleware = new TenantContextMiddleware();
    mockRequest = {
      headers: {},
      hostname: 'example.com',
      originalUrl: '/api/content',
    };
    mockResponse = {
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();

    // Reset environment variable
    delete process.env.DEFAULT_TENANT_ID;
  });

  afterAll(() => {
    // Restore original environment variable
    if (originalEnv) {
      process.env.DEFAULT_TENANT_ID = originalEnv;
    } else {
      delete process.env.DEFAULT_TENANT_ID;
    }
  });

  describe('use', () => {
    it('should set tenantContext to null for excluded path /health', () => {
      mockRequest.originalUrl = '/health';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest['tenantContext']).toBeNull();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
    });

    it('should set tenantContext to null for excluded path /api/public', () => {
      mockRequest.originalUrl = '/api/public';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest['tenantContext']).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set tenantContext to null for excluded path with subpath /api/public/docs', () => {
      mockRequest.originalUrl = '/api/public/docs';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest['tenantContext']).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract tenant from x-tenant-id header', () => {
      mockRequest.headers = { 'x-tenant-id': 'tenant123' };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest['tenantContext']).toEqual({
        tenantId: 'tenant123',
        source: 'header',
      });
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-tenant-id', 'tenant123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract tenant from subdomain', () => {
      mockRequest.hostname = 'acme.example.com';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest['tenantContext']).toEqual({
        tenantId: 'acme',
        subdomain: 'acme',
        source: 'subdomain',
      });
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-tenant-id', 'acme');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use default tenant when configured', () => {
      process.env.DEFAULT_TENANT_ID = 'default-tenant';
      middleware = new TenantContextMiddleware();
      mockRequest.hostname = 'localhost';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest['tenantContext']).toEqual({
        tenantId: 'default-tenant',
        source: 'default',
      });
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-tenant-id', 'default-tenant');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set tenantContext to null when no tenant is found and no default configured', () => {
      // Ensure no default tenant is set
      delete process.env.DEFAULT_TENANT_ID;
      middleware = new TenantContextMiddleware();
      mockRequest.hostname = 'localhost';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest['tenantContext']).toBeNull();
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw BadRequestException when extractTenantContext throws error', () => {
      mockRequest['requestId'] = 'req-123';
      jest.spyOn(middleware as any, 'extractTenantContext').mockImplementation(() => {
        throw new Error('Custom error');
      });

      expect(() => {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(BadRequestException);
    });

    it('should include requestId in error when available', () => {
      mockRequest['requestId'] = 'req-456';
      jest.spyOn(middleware as any, 'extractTenantContext').mockImplementation(() => {
        throw new Error('Test error');
      });

      try {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          const response = error.getResponse() as Record<string, unknown>;
          expect(response).toMatchObject({
            message: 'Unable to determine tenant context',
            requestId: 'req-456',
            error: 'Test error',
          });
        }
      }
    });

    it('should use "no-request-id" when requestId is not available', () => {
      jest.spyOn(middleware as any, 'extractTenantContext').mockImplementation(() => {
        throw new Error('Test error');
      });

      try {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          const response = error.getResponse() as Record<string, unknown>;
          expect(response).toMatchObject({
            requestId: 'no-request-id',
          });
        }
      }
    });

    it('should handle non-Error exceptions', () => {
      jest.spyOn(middleware as any, 'extractTenantContext').mockImplementation(() => {
        throw 'String error';
      });

      try {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          const response = error.getResponse() as Record<string, unknown>;
          expect(response).toMatchObject({
            error: 'Unknown error occurred',
          });
        }
      }
    });

    it('should prioritize header over subdomain', () => {
      mockRequest.headers = { 'x-tenant-id': 'header-tenant' };
      mockRequest.hostname = 'subdomain.example.com';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest['tenantContext']).toEqual({
        tenantId: 'header-tenant',
        source: 'header',
      });
    });

    it('should prioritize subdomain over default tenant', () => {
      process.env.DEFAULT_TENANT_ID = 'default-tenant';
      middleware = new TenantContextMiddleware();
      mockRequest.hostname = 'custom.example.com';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest['tenantContext']).toEqual({
        tenantId: 'custom',
        subdomain: 'custom',
        source: 'subdomain',
      });
    });

    it('should not set response header when tenantContext is null', () => {
      delete process.env.DEFAULT_TENANT_ID;
      middleware = new TenantContextMiddleware();
      mockRequest.hostname = 'www.example.com';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest['tenantContext']).toBeNull();
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty requestId', () => {
      mockRequest['requestId'] = '';
      jest.spyOn(middleware as any, 'extractTenantContext').mockImplementation(() => {
        throw new Error('Test error');
      });

      try {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          const response = error.getResponse() as Record<string, unknown>;
          expect(response).toMatchObject({
            requestId: 'no-request-id',
          });
        }
      }
    });

    it('should handle null error object', () => {
      jest.spyOn(middleware as any, 'extractTenantContext').mockImplementation(() => {
        throw null;
      });

      try {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          const response = error.getResponse() as Record<string, unknown>;
          expect(response).toMatchObject({
            error: 'Unknown error occurred',
          });
        }
      }
    });

    it('should handle undefined error object', () => {
      jest.spyOn(middleware as any, 'extractTenantContext').mockImplementation(() => {
        throw undefined;
      });

      try {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          const response = error.getResponse() as Record<string, unknown>;
          expect(response).toMatchObject({
            error: 'Unknown error occurred',
          });
        }
      }
    });
  });

  describe('extractTenantContext', () => {
    it('should extract tenant from header', () => {
      mockRequest.headers = { 'x-tenant-id': 'test-tenant' };

      const result = middleware['extractTenantContext'](mockRequest as Request);

      expect(result).toEqual({
        tenantId: 'test-tenant',
        source: 'header',
      });
    });

    it('should extract tenant from subdomain', () => {
      mockRequest.hostname = 'mytenant.example.com';

      const result = middleware['extractTenantContext'](mockRequest as Request);

      expect(result).toEqual({
        tenantId: 'mytenant',
        subdomain: 'mytenant',
        source: 'subdomain',
      });
    });

    it('should return default tenant when no header or subdomain', () => {
      process.env.DEFAULT_TENANT_ID = 'fallback-tenant';
      middleware = new TenantContextMiddleware();
      mockRequest.hostname = 'localhost';

      const result = middleware['extractTenantContext'](mockRequest as Request);

      expect(result).toEqual({
        tenantId: 'fallback-tenant',
        source: 'default',
      });
    });

    it('should return null when no tenant is available and no default configured', () => {
      delete process.env.DEFAULT_TENANT_ID;
      middleware = new TenantContextMiddleware();
      mockRequest.hostname = 'localhost';

      const result = middleware['extractTenantContext'](mockRequest as Request);

      expect(result).toBeNull();
    });

    it('should extract tenant from header even with empty string as default', () => {
      process.env.DEFAULT_TENANT_ID = '';
      middleware = new TenantContextMiddleware();
      mockRequest.headers = { 'x-tenant-id': 'header-tenant' };

      const result = middleware['extractTenantContext'](mockRequest as Request);

      expect(result).toEqual({
        tenantId: 'header-tenant',
        source: 'header',
      });
    });

    it('should handle array header value by taking first element', () => {
      mockRequest.headers = { 'x-tenant-id': ['tenant1', 'tenant2'] };

      const result = middleware['extractTenantContext'](mockRequest as Request);

      expect(result).toEqual({
        tenantId: 'tenant1',
        source: 'header',
      });
    });
  });

  describe('extractSubdomain', () => {
    it('should extract subdomain from valid hostname', () => {
      const result = middleware['extractSubdomain']('tenant.example.com');
      expect(result).toBe('tenant');
    });

    it('should extract subdomain from multi-level domain', () => {
      const result = middleware['extractSubdomain']('tenant.app.example.com');
      expect(result).toBe('tenant');
    });

    it('should return null for localhost', () => {
      const result = middleware['extractSubdomain']('localhost');
      expect(result).toBeNull();
    });

    it('should return null for IPv4 address', () => {
      const result = middleware['extractSubdomain']('192.168.1.1');
      expect(result).toBeNull();
    });

    it('should return null for another IPv4 address', () => {
      const result = middleware['extractSubdomain']('10.0.0.1');
      expect(result).toBeNull();
    });

    it('should return null for www subdomain', () => {
      const result = middleware['extractSubdomain']('www.example.com');
      expect(result).toBeNull();
    });

    it('should return null for api subdomain', () => {
      const result = middleware['extractSubdomain']('api.example.com');
      expect(result).toBeNull();
    });

    it('should return null for admin subdomain', () => {
      const result = middleware['extractSubdomain']('admin.example.com');
      expect(result).toBeNull();
    });

    it('should return null for app subdomain', () => {
      const result = middleware['extractSubdomain']('app.example.com');
      expect(result).toBeNull();
    });

    it('should return null for two-part domain', () => {
      const result = middleware['extractSubdomain']('example.com');
      expect(result).toBeNull();
    });

    it('should return null for single-part domain', () => {
      const result = middleware['extractSubdomain']('localhost');
      expect(result).toBeNull();
    });

    it('should extract valid subdomain that is not in ignored list', () => {
      const result = middleware['extractSubdomain']('custom.example.com');
      expect(result).toBe('custom');
    });

    it('should extract subdomain with hyphens', () => {
      const result = middleware['extractSubdomain']('my-tenant.example.com');
      expect(result).toBe('my-tenant');
    });

    it('should extract subdomain with numbers', () => {
      const result = middleware['extractSubdomain']('tenant123.example.com');
      expect(result).toBe('tenant123');
    });

    it('should return null for 127.0.0.1', () => {
      const result = middleware['extractSubdomain']('127.0.0.1');
      expect(result).toBeNull();
    });

    it('should return null for 0.0.0.0', () => {
      const result = middleware['extractSubdomain']('0.0.0.0');
      expect(result).toBeNull();
    });

    it('should extract subdomain from four-level domain', () => {
      const result = middleware['extractSubdomain']('tenant.staging.example.com');
      expect(result).toBe('tenant');
    });

    it('should extract subdomain with uppercase letters', () => {
      const result = middleware['extractSubdomain']('MyTenant.example.com');
      expect(result).toBe('MyTenant');
    });

    it('should extract subdomain with mixed case', () => {
      const result = middleware['extractSubdomain']('Test123-Tenant.example.com');
      expect(result).toBe('Test123-Tenant');
    });
  });

  describe('isExcludedPath', () => {
    it('should return true for exact match /health', () => {
      const result = middleware['isExcludedPath']('/health');
      expect(result).toBe(true);
    });

    it('should return true for exact match /api/public', () => {
      const result = middleware['isExcludedPath']('/api/public');
      expect(result).toBe(true);
    });

    it('should return true for exact match /api/auth/register', () => {
      const result = middleware['isExcludedPath']('/api/auth/register');
      expect(result).toBe(true);
    });

    it('should return true for path starting with /health/', () => {
      const result = middleware['isExcludedPath']('/health/check');
      expect(result).toBe(true);
    });

    it('should return true for path starting with /api/public/', () => {
      const result = middleware['isExcludedPath']('/api/public/docs');
      expect(result).toBe(true);
    });

    it('should return true for nested path under excluded path', () => {
      const result = middleware['isExcludedPath']('/api/public/v1/resource');
      expect(result).toBe(true);
    });

    it('should return false for non-excluded path', () => {
      const result = middleware['isExcludedPath']('/api/content');
      expect(result).toBe(false);
    });

    it('should return false for path that partially matches excluded path', () => {
      const result = middleware['isExcludedPath']('/healthcheck');
      expect(result).toBe(false);
    });

    it('should return false for path similar to excluded path', () => {
      const result = middleware['isExcludedPath']('/api/private');
      expect(result).toBe(false);
    });

    it('should return false for empty path', () => {
      const result = middleware['isExcludedPath']('');
      expect(result).toBe(false);
    });

    it('should return false for root path', () => {
      const result = middleware['isExcludedPath']('/');
      expect(result).toBe(false);
    });

    it('should return false for path with query parameters on non-excluded path', () => {
      const result = middleware['isExcludedPath']('/api/content?id=123');
      expect(result).toBe(false);
    });

    it('should return false for excluded path with query parameters (query params are part of path)', () => {
      // The originalUrl includes query parameters, so /health?detailed=true doesn't start with /health/
      const result = middleware['isExcludedPath']('/health?detailed=true');
      expect(result).toBe(false);
    });

    it('should handle paths with trailing slashes', () => {
      const result = middleware['isExcludedPath']('/health/');
      expect(result).toBe(true);
    });

    it('should return true for /api/auth/register with subpath', () => {
      const result = middleware['isExcludedPath']('/api/auth/register/confirm');
      expect(result).toBe(true);
    });

    it('should return false for /api/auth/login (not in excluded list)', () => {
      const result = middleware['isExcludedPath']('/api/auth/login');
      expect(result).toBe(false);
    });

    it('should return false for path that starts with excluded but without slash', () => {
      const result = middleware['isExcludedPath']('/healthcare');
      expect(result).toBe(false);
    });

    it('should handle case-sensitive paths correctly', () => {
      const result = middleware['isExcludedPath']('/Health');
      expect(result).toBe(false);
    });
  });
});
