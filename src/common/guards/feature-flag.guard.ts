import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  private readonly enabledFeatures: Set<string> = new Set(['new-dashboard', 'beta-reports']);
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const requiredFlag = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFlag) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const requestId = request.requestId || 'no-request-id';
    const tenantId = request.tenantContext?.tenantId as string | undefined;

    // Check if feature is enabled (can be tenant-specific)
    const isEnabled = this.isFeatureEnabled(requiredFlag, tenantId);

    if (!isEnabled) {
      throw new ForbiddenException({
        message: 'Feature not available',
        code: 'FEATURE_DISABLED',
        feature: requiredFlag,
        requestId,
      });
    }

    return true;
  }

  private isFeatureEnabled(flag: string, tenantId?: string): boolean {
    // Simple implementation - replace with actual feature flag service
    // Could check tenant-specific flags, user flags, etc.
    console.log('Checking feature flag for tenant:', tenantId);
    return this.enabledFeatures.has(flag);
  }
}
