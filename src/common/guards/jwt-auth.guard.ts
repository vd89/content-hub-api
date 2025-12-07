import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<T>(err: Error | null, user: T, info: Error | null, context: ExecutionContext): T {
    const request = context.switchToHttp().getRequest();
    const requestId: string = (request.requestId as string) || ('no-request-id' as string);

    if (info instanceof TokenExpiredError) {
      throw new UnauthorizedException({
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
        requestId,
      });
    }

    if (info instanceof JsonWebTokenError) {
      throw new UnauthorizedException({
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
        requestId,
      });
    }

    if (info?.message === 'No auth token') {
      throw new UnauthorizedException({
        message: 'Authentication token is required',
        code: 'TOKEN_MISSING',
        requestId,
      });
    }

    if (err || !user) {
      throw new UnauthorizedException({
        message: 'Unauthorized access',
        code: 'UNAUTHORIZED',
        requestId,
      });
    }

    return user;
  }
}
