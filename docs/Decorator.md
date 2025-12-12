# Decorators Documentation

## Overview

Custom decorators in this application provide a clean and reusable way to extract data from requests, define metadata, and enhance route handlers with additional functionality.

## Available Decorators

### 1. @CurrentUser()

**Location:** `src/auth/decorators/current-user.decorator.ts`

**Purpose:** Extracts the authenticated user from the request object.

**Type:** Parameter Decorator

**Usage:**

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  @Get()
  getProfile(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
    };
  }

  @Get('settings')
  getSettings(@CurrentUser() user: User) {
    return this.settingsService.findByUserId(user.id);
  }
}
```

**What it extracts:**

- Full user object attached by JwtAuthGuard
- Includes: id, email, name, roles, tenantId, etc.

**Prerequisites:**

- Must be used with `@UseGuards(JwtAuthGuard)`
- User must be authenticated

**Common Use Cases:**

```typescript
// Get user ID for database queries
@Post('articles')
create(@CurrentUser() user: User, @Body() dto: CreateArticleDto) {
  return this.articlesService.create(user.id, dto);
}

// Check user permissions
@Get(':id')
findOne(@CurrentUser() user: User, @Param('id') id: string) {
  return this.articlesService.findOneForUser(id, user.id);
}

// Audit logging
@Patch(':id')
update(
  @CurrentUser() user: User,
  @Param('id') id: string,
  @Body() dto: UpdateArticleDto,
) {
  this.logger.log(`User ${user.email} updating article ${id}`);
  return this.articlesService.update(id, dto);
}
```

---

### 2. @Roles()

**Location:** `src/auth/decorators/roles.decorator.ts`

**Purpose:** Defines required roles for accessing a route or controller.

**Type:** Method/Class Decorator

**Usage:**

```typescript
import { Controller, Get, Post, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('articles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArticlesController {

  // Multiple roles - user needs at least one
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  findAll() {
    return 'Accessible by ADMIN, EDITOR, or VIEWER';
  }

  // Single role
  @Post()
  @Roles(UserRole.ADMIN)
  create() {
    return 'Only ADMIN can create';
  }

  // Controller-level roles
  @Controller('admin')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  export class AdminController {
    // All routes require ADMIN role
  }
}
```

**Role Enum:**

```typescript
export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}
```

**How it works:**

- Sets metadata using `SetMetadata('roles', [...roles])`
- RolesGuard reads this metadata
- Compares with user's roles from JWT token

**Role Hierarchy Examples:**

```typescript
// Public routes (no roles needed)
@Get('public')
findPublic() {
  return 'Public content';
}

// Viewer level (read-only)
@Get()
@Roles(UserRole.VIEWER, UserRole.EDITOR, UserRole.ADMIN)
findAll() {
  return 'Can view';
}

// Editor level (read-write)
@Post()
@Roles(UserRole.EDITOR, UserRole.ADMIN)
create(@Body() dto: CreateDto) {
  return 'Can create/edit';
}

// Admin level (full control)
@Delete(':id')
@Roles(UserRole.ADMIN)
remove(@Param('id') id: string) {
  return 'Can delete';
}
```

---

### 3. @Public()

**Location:** `src/auth/decorators/public.decorator.ts`

**Purpose:** Marks routes as public, bypassing authentication guards.

**Type:** Method/Class Decorator

**Usage:**

```typescript
import { Controller, Post, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  @Post('login')
  @Public()
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @Public()
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('forgot-password')
  @Public()
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Get('profile')
  // Protected route (no @Public decorator)
  getProfile(@CurrentUser() user: User) {
    return user;
  }
}
```

**When to use:**

- Login/Registration endpoints
- Password reset endpoints
- Public content endpoints
- Health check endpoints
- Documentation endpoints

**Important Notes:**

- Only works when guards are applied globally
- Route-level guards still apply
- Use sparingly for security

---

### 4. @TenantId()

**Location:** `src/common/decorators/tenant-id.decorator.ts`

**Purpose:** Extracts tenant ID from the request context (multi-tenancy support).

**Type:** Parameter Decorator

**Usage:**

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('articles')
@UseGuards(JwtAuthGuard)
export class ArticlesController {
  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.articlesService.findAllByTenant(tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(tenantId, dto);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.articlesService.findOne(tenantId, id);
  }
}
```

**How it works:**

- Extracts from `request.tenantId`
- Set by TenantContextMiddleware
- Ensures data isolation between tenants

**Multi-tenancy Patterns:**

```typescript
// Pattern 1: Filter by tenant
@Get()
findAll(@TenantId() tenantId: string) {
  return this.repository.find({ where: { tenantId } });
}

// Pattern 2: Create with tenant
@Post()
create(@TenantId() tenantId: string, @Body() dto: CreateDto) {
  return this.repository.save({ ...dto, tenantId });
}

// Pattern 3: Validate tenant ownership
@Get(':id')
async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
  const item = await this.repository.findOne({ where: { id } });
  if (item.tenantId !== tenantId) {
    throw new ForbiddenException('Access denied');
  }
  return item;
}
```

---

## Combining Decorators

### Example 1: Authenticated Endpoint with User

```typescript
@Get('my-articles')
@UseGuards(JwtAuthGuard)
findMyArticles(@CurrentUser() user: User) {
  return this.articlesService.findByAuthor(user.id);
}
```

### Example 2: Role-Based Access with Tenant

```typescript
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EDITOR, UserRole.ADMIN)
create(
  @CurrentUser() user: User,
  @TenantId() tenantId: string,
  @Body() dto: CreateArticleDto,
) {
  return this.articlesService.create({
    ...dto,
    authorId: user.id,
    tenantId,
  });
}
```

### Example 3: Admin-Only with Full Context

```typescript
@Delete(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
remove(
  @CurrentUser() user: User,
  @TenantId() tenantId: string,
  @Param('id') id: string,
) {
  this.logger.log(`Admin ${user.email} deleting article ${id} for tenant ${tenantId}`);
  return this.articlesService.remove(tenantId, id);
}
```

## Creating Custom Decorators

### Parameter Decorator Example

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const RequestId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.id;
});
```

### Metadata Decorator Example

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### Composite Decorator Example

```typescript
import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';

export function Auth(...roles: UserRole[]) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...roles),
  );
}

// Usage:
@Get()
@Auth(UserRole.ADMIN, UserRole.EDITOR)
findAll() {
  return 'Protected and authorized';
}
```

## Best Practices

1. **Type Safety**
   - Always type decorator parameters
   - Use interfaces/classes for complex types

2. **Validation**
   - Validate decorator data before use
   - Handle missing data gracefully

3. **Documentation**
   - Document what each decorator does
   - Include usage examples

4. **Composition**
   - Combine decorators for common patterns
   - Create composite decorators for frequently used combinations

5. **Testing**
   - Test decorators with different scenarios
   - Mock ExecutionContext for unit tests

## Related Documentation

- [Guards Documentation](./Guard.md)
- [Middleware Documentation](./MIDDLEWARE.md)
<!-- - [Authentication Documentation](./authentication.md) -->
