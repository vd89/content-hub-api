# Guards Documentation

## Overview

Guards in NestJS are used to determine whether a request should be handled by the route handler or not. In this application, we implement guards for authentication and authorization (role-based access control).

## Guard Execution Order

Guards are executed in the following order:

1. **JwtAuthGuard** - Validates JWT token and authenticates the user
2. **RolesGuard** - Checks if the authenticated user has the required roles

## Available Guards

### 1. JwtAuthGuard

**Location:** `src/auth/guards/jwt-auth.guard.ts`

**Purpose:** Validates JWT tokens and authenticates users for protected routes.

**How it works:**

- Extends Passport's `AuthGuard('jwt')`
- Extracts JWT token from the Authorization header
- Validates token using JWT strategy
- Attaches user information to the request object

**Usage:**

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('articles')
export class ArticlesController {
  // Protect a single route
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return 'Protected route';
  }

  // Protect entire controller
  @UseGuards(JwtAuthGuard)
  @Controller('protected')
  export class ProtectedController {
    // All routes here are protected
  }
}
```

**Request Flow:**

```
Client Request → JwtAuthGuard → JWT Validation → Route Handler
                       ↓
                  (if invalid)
                       ↓
                401 Unauthorized
```

### 2. RolesGuard

**Location:** `src/auth/guards/roles.guard.ts`

**Purpose:** Implements role-based access control (RBAC) to restrict access based on user roles.

**How it works:**

- Checks for required roles using the `@Roles()` decorator
- Compares user's roles against required roles
- Allows access if user has at least one of the required roles

**Usage:**

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('articles')
@UseGuards(JwtAuthGuard, RolesGuard) // Apply both guards
export class ArticlesController {
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  findAll() {
    return 'Accessible by ADMIN, EDITOR, and VIEWER';
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  create() {
    return 'Only ADMIN and EDITOR can create';
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove() {
    return 'Only ADMIN can delete';
  }
}
```

**Request Flow:**

```
Client Request → JwtAuthGuard → User Authenticated → RolesGuard → Check Roles → Route Handler
                       ↓                                    ↓
                  (if invalid)                        (if unauthorized)
                       ↓                                    ↓
                401 Unauthorized                      403 Forbidden
```

## Guard Combinations

### Authentication Only

Use when you need to verify the user is logged in but don't need role-based restrictions:

```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(@CurrentUser() user) {
  return user;
}
```

### Authentication + Authorization

Use when you need both authentication and role-based access:

```typescript
@Delete(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
deleteArticle(@Param('id') id: string) {
  return this.articlesService.remove(id);
}
```

### Global Guards

To apply guards globally, configure in `main.ts`:

```typescript
import { NestFactory, Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply JwtAuthGuard globally
  app.useGlobalGuards(new JwtAuthGuard());

  // Apply RolesGuard globally
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new RolesGuard(reflector));

  await app.listen(3000);
}
```

## Public Routes

To exclude specific routes from global guards, use the `@Public()` decorator:

```typescript
@Controller('auth')
export class AuthController {
  @Post('login')
  @Public() // This route bypasses JwtAuthGuard
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
```

## Error Responses

### 401 Unauthorized

Returned when JWT token is missing, invalid, or expired:

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden

Returned when user doesn't have required roles:

```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

## Best Practices

1. **Always use JwtAuthGuard before RolesGuard**
   - RolesGuard depends on user information from JwtAuthGuard

2. **Apply guards at controller level when possible**
   - Reduces code duplication
   - Makes security requirements clear

3. **Use specific roles**
   - Define clear role hierarchies
   - Use UserRole enum for type safety

4. **Document protected endpoints**
   - Clearly indicate which roles can access endpoints
   - Include in API documentation

5. **Handle guard errors gracefully**
   - Provide clear error messages
   - Log unauthorized access attempts

## Testing Guards

```typescript
import { Test } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should allow access when user has required role', () => {
    // Test implementation
  });

  it('should deny access when user lacks required role', () => {
    // Test implementation
  });
});
```

## Related Documentation

- [Decorators Documentation](./Decorator.md)
- [Middleware Documentation](./MIDDLEWARE.md)
<!-- - [Authentication Documentation](./authentication.md) -->
