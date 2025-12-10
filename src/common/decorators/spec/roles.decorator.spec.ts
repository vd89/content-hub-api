import { SetMetadata } from '@nestjs/common';
import { Roles, ROLES_KEY } from '../roles.decorator';

// Mock SetMetadata
jest.mock('@nestjs/common', () => ({
  SetMetadata: jest.fn((key, value) => {
    return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
      return descriptor;
    };
  }),
}));

describe('Roles Decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ROLES_KEY', () => {
    it('should export ROLES_KEY constant with value "roles"', () => {
      expect(ROLES_KEY).toBe('roles');
    });

    it('should be of type string', () => {
      expect(typeof ROLES_KEY).toBe('string');
    });
  });

  describe('Roles', () => {
    it('should call SetMetadata with ROLES_KEY and single role', () => {
      const role = 'admin';
      Roles(role);

      expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, [role]);
      expect(SetMetadata).toHaveBeenCalledTimes(1);
    });

    it('should call SetMetadata with ROLES_KEY and multiple roles', () => {
      const roles = ['admin', 'user', 'moderator'];
      Roles(...roles);

      expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, roles);
      expect(SetMetadata).toHaveBeenCalledTimes(1);
    });

    it('should call SetMetadata with ROLES_KEY and empty array when no roles provided', () => {
      Roles();

      expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, []);
      expect(SetMetadata).toHaveBeenCalledTimes(1);
    });

    it('should return a decorator function', () => {
      const decorator = Roles('admin');
      expect(typeof decorator).toBe('function');
    });

    it('should handle two roles', () => {
      Roles('admin', 'user');

      expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, ['admin', 'user']);
    });

    it('should preserve role order', () => {
      const roles = ['role1', 'role2', 'role3'];
      Roles(...roles);

      const callArgs = (SetMetadata as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toEqual(roles);
    });

    it('should handle roles with special characters', () => {
      const specialRoles = ['admin-super', 'user_basic', 'moderator.advanced'];
      Roles(...specialRoles);

      expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, specialRoles);
    });
  });
});
