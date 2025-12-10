import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const requestId = request.requestId || 'no-request-id';

    if (!user) {
      throw new ForbiddenException({
        message: 'User not Authenticated',
        code: 'USER_NOT_FOUND',
        requestId,
      });
    }
    const userRoles: string[] = user.roles || [];
    const hasRole = requiredRoles.some((roles) => userRoles.includes(roles));

    if (!hasRole) {
      throw new ForbiddenException({
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_ROLES',
        requiredRoles,
        userRoles,
        requestId,
      });
    }
    return true;
  }
}
