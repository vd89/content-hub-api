export interface AuthenticatedUser {
  userId: string;
  email: string;
  tenantId?: string;
  roles: string[];
}
