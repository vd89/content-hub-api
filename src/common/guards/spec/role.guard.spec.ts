import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../role.guard';
import { ROLES_KEY } from '../../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockExecutionContext = (user?: any, requestId?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          requestId,
        }),
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should return true when no roles are required', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockExecutionContext({ id: 1, roles: ['user'] });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when required roles is an empty array', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
      const context = createMockExecutionContext({ id: 1, roles: ['user'] });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when user has the required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: 1, roles: ['admin'] });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when user has one of multiple required roles', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'moderator']);
      const context = createMockExecutionContext({ id: 1, roles: ['moderator'] });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when user has multiple roles and one matches required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: 1, roles: ['user', 'admin', 'editor'] });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user is not authenticated', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const context = createMockExecutionContext(undefined, 'req-123');

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).message).toBe('User not Authenticated');
        expect((error as ForbiddenException).getResponse()).toEqual({
          message: 'User not Authenticated',
          code: 'USER_NOT_FOUND',
          requestId: 'req-123',
        });
      }
    });

    it('should throw ForbiddenException with default requestId when user is not authenticated and requestId is missing', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const context = createMockExecutionContext(undefined);

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).getResponse()).toEqual({
          message: 'User not Authenticated',
          code: 'USER_NOT_FOUND',
          requestId: 'no-request-id',
        });
      }
    });

    it('should throw ForbiddenException when user does not have required role', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: 1, roles: ['user'] }, 'req-456');

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).message).toBe('Insufficient permissions');
        expect((error as ForbiddenException).getResponse()).toEqual({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_ROLES',
          requiredRoles: ['admin'],
          userRoles: ['user'],
          requestId: 'req-456',
        });
      }
    });

    it('should throw ForbiddenException when user has no roles property', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: 1 }, 'req-789');

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).getResponse()).toEqual({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_ROLES',
          requiredRoles: ['admin'],
          userRoles: [],
          requestId: 'req-789',
        });
      }
    });

    it('should throw ForbiddenException when user has empty roles array', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: 1, roles: [] }, 'req-999');

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).getResponse()).toEqual({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_ROLES',
          requiredRoles: ['admin'],
          userRoles: [],
          requestId: 'req-999',
        });
      }
    });

    it('should throw ForbiddenException when none of user roles match required roles', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'superadmin']);
      const context = createMockExecutionContext({ id: 1, roles: ['user', 'editor'] }, 'req-111');

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).getResponse()).toEqual({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_ROLES',
          requiredRoles: ['admin', 'superadmin'],
          userRoles: ['user', 'editor'],
          requestId: 'req-111',
        });
      }
    });

    it('should call reflector.getAllAndOverride with correct parameters', async () => {
      const getAllAndOverrideSpy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: 1, roles: ['admin'] });

      await guard.canActivate(context);

      expect(getAllAndOverrideSpy).toHaveBeenCalledWith(ROLES_KEY, [context.getHandler(), context.getClass()]);
    });

    it('should handle null user gracefully', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const context = createMockExecutionContext(null, 'req-null');

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should use default requestId when requestId is undefined', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: 1, roles: ['user'] });

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(((error as ForbiddenException).getResponse() as any).requestId).toBe('no-request-id');
      }
    });
  });
});
