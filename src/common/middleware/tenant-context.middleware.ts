import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface TenantContext {
  tenantId: string;
  subdomain?: string;
  source: 'subdomain' | 'header' | 'default';
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  // Routes that don't require tenant context
  private readonly excludedPaths: string[] = ['/health', '/api/public', '/api/auth/register'];

  // Default tenant for development or single-tenant fallback
  private readonly defaultTenant: string | null = process.env.DEFAULT_TENANT_ID || null;

  use(req: Request, res: Response, next: NextFunction) {
    const requestId: string = (req['requestId'] as string) || 'no-request-id';

    // Skip tenant extraction for excluded paths
    if (this.isExcludedPath(req.originalUrl)) {
      req['tenantContext'] = null;
      return next();
    }

    try {
      const tenantContext = this.extractTenantContext(req);
      req['tenantContext'] = tenantContext;

      // Add tenant ID to response headers for debugging
      if (tenantContext) {
        res.setHeader('x-tenant-id', tenantContext.tenantId);
      }

      next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new BadRequestException({
        message: 'Unable to determine tenant context',
        requestId,
        error: errorMessage,
      });
    }
  }

  private extractTenantContext(req: Request): TenantContext | null {
    // Priority 1: Check x-tenant-id header (useful for API clients)
    const headerTenantId = req.headers['x-tenant-id'];
    if (headerTenantId) {
      // Handle array header values by taking the first element
      const tenantId = Array.isArray(headerTenantId) ? headerTenantId[0] : headerTenantId;
      return {
        tenantId,
        source: 'header',
      };
    }

    // Priority 2: Extract from subdomain (e.g., acme.yourapp.com)
    const subdomain = this.extractSubdomain(req.hostname);
    if (subdomain) {
      return {
        tenantId: subdomain,
        subdomain,
        source: 'subdomain',
      };
    }

    // Priority 3: Use default tenant if configured
    if (this.defaultTenant) {
      return {
        tenantId: this.defaultTenant,
        source: 'default',
      };
    }

    // No tenant context found - handle based on your requirements
    // Option A: Return null (allow request to proceed without tenant)
    // Option B: Throw error (uncomment below)
    // throw new Error('Tenant identification required');

    return null;
  }

  private extractSubdomain(hostname: string): string | null {
    // Handle localhost and IP addresses
    if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return null;
    }

    const parts = hostname.split('.');

    // Expecting format: tenant.domain.com (3+ parts)
    // Adjust based on your domain structure
    if (parts.length >= 3) {
      const subdomain = parts[0];

      // Ignore common non-tenant subdomains
      const ignoredSubdomains = ['www', 'api', 'admin', 'app'];
      if (!ignoredSubdomains.includes(subdomain)) {
        return subdomain;
      }
    }

    return null;
  }

  private isExcludedPath(path: string): boolean {
    return this.excludedPaths.some((excluded) => path === excluded || path.startsWith(`${excluded}/`));
  }
}
