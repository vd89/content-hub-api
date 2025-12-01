# Middleware Documentation

## Overview

This document describes the middleware architecture implemented in the Content Hub API. The application uses three custom middleware components that are applied globally to all routes, providing request tracking, logging, and tenant context management.

## Middleware Stack

The middleware are applied in the following order:

1. **RequestIdMiddleware** - Generates unique request identifiers
2. **LoggerMiddleware** - Logs request and response details
3. **TenantContextMiddleware** - Manages multi-tenant context

## Middleware Components

### 1. RequestIdMiddleware

**File Location:** `/src/common/middleware/request-id.middleware.ts`

**Purpose:** Generates and attaches a unique identifier to each incoming HTTP request for tracing and debugging purposes.

**Functionality:**

- Generates a UUID v4 for each request
- Attaches the request ID to the request object
- Adds the `X-Request-ID` header to both request and response
- Enables request tracing across distributed systems

**Implementation Details:**

```typescript
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = uuidv4();
    req['requestId'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  }
}
```

**Headers:**

- **Input:** Accepts `X-Request-ID` header (optional)
- **Output:** Sets `X-Request-ID` header in response

**Use Cases:**

- Request tracking in logs
- Debugging distributed systems
- Correlating requests across microservices
- Error tracking and reporting

---

### 2. LoggerMiddleware

**File Location:** `/src/common/middleware/logger.middleware.ts`

**Purpose:** Provides comprehensive logging for all HTTP requests and responses, including timing information and error tracking.

**Functionality:**

- Logs incoming request details (method, URL, headers)
- Captures and logs response status and timing
- Includes request ID for correlation
- Logs errors with stack traces
- Calculates request duration

**Implementation Details:**

```typescript
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, headers } = req;
    const requestId = req['requestId'];
    const startTime = Date.now();

    // Log incoming request
    this.logger.log(`Incoming Request: ${method} ${originalUrl} [${requestId}]`);

    // Capture response finish event
    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      this.logger.log(`Response: ${method} ${originalUrl} ${statusCode} - ${duration}ms [${requestId}]`);
    });

    next();
  }
}
```

**Logged Information:**

- HTTP method (GET, POST, PUT, DELETE, etc.)
- Request URL and path
- Request ID for correlation
- Response status code
- Request duration in milliseconds
- Error details (if any)

**Log Format:**

```
Incoming Request: GET /api/articles [abc-123-def]
Response: GET /api/articles 200 - 45ms [abc-123-def]
```

**Use Cases:**

- Performance monitoring
- Debugging and troubleshooting
- API usage analytics
- Security auditing
- Request/response correlation

---

### 3. TenantContextMiddleware

**File Location:** `/src/common/middleware/tenant-context.middleware.ts`

**Purpose:** Manages multi-tenant context by extracting tenant information from requests and making it available throughout the application lifecycle.

**Functionality:**

- Extracts tenant ID from request headers or subdomain
- Stores tenant context using AsyncLocalStorage
- Makes tenant information available in services and controllers
- Supports multi-tenancy architecture

**Implementation Details:**

```typescript
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    req['tenantId'] = tenantId;

    // Store in AsyncLocalStorage for access in services
    asyncLocalStorage.run(new Map([['tenantId', tenantId]]), () => {
      next();
    });
  }
}
```

**Headers:**

- **Input:** `X-Tenant-ID` header (required for multi-tenant operations)
- **Default:** Falls back to 'default' tenant if header is missing

**Tenant Identification Methods:**

1. **Header-based:** `X-Tenant-ID` header
2. **Subdomain-based:** Extract from subdomain (e.g., tenant1.api.com)
3. **JWT token:** Extract from authentication token claims

**Use Cases:**

- Multi-tenant SaaS applications
- Data isolation between tenants
- Tenant-specific configuration
- Resource access control
- Billing and usage tracking per tenant

---

## Integration

### Module Configuration

The middleware are registered in the `AppModule` using the `NestModule` interface:

**File Location:** `/src/app.module.ts`

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    ArticlesModule,
    UsersModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, LoggerMiddleware, TenantContextMiddleware).forRoutes('*');
  }
}
```

### Execution Order

Middleware execute in the order they are applied:

```
Request → RequestIdMiddleware → LoggerMiddleware → TenantContextMiddleware → Route Handler → Response
```

**Why this order matters:**

1. **RequestIdMiddleware first** - Generates ID used by other middleware
2. **LoggerMiddleware second** - Uses request ID for logging
3. **TenantContextMiddleware third** - Uses request ID and logging context

---

## Usage Examples

### Accessing Request ID in Controllers

```typescript
@Controller('articles')
export class ArticlesController {
  @Get()
  findAll(@Req() request: Request) {
    const requestId = request['requestId'];
    // Use requestId for tracking
    return this.articlesService.findAll();
  }
}
```

### Accessing Tenant Context in Services

```typescript
@Injectable()
export class ArticlesService {
  findAll() {
    const tenantId = asyncLocalStorage.getStore()?.get('tenantId');
    // Use tenantId for filtering data
    return this.repository.find({ where: { tenantId } });
  }
}
```

### Client-Side Headers

**Making a request with tenant context:**

```bash
curl -X GET http://localhost:3000/api/articles \
  -H "X-Tenant-ID: tenant-123" \
  -H "Authorization: Bearer <token>"
```

**Response includes request ID:**

```
HTTP/1.1 200 OK
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Logging Configuration
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true

# Tenant Configuration
DEFAULT_TENANT_ID=default
ENABLE_MULTI_TENANCY=true
```

### Module Dependencies

Ensure the `CommonModule` is imported where middleware are defined:

```typescript
@Module({
  providers: [RequestIdMiddleware, LoggerMiddleware, TenantContextMiddleware],
  exports: [RequestIdMiddleware, LoggerMiddleware, TenantContextMiddleware],
})
export class CommonModule {}
```

---

## Testing

### Unit Testing Middleware

**Example: Testing RequestIdMiddleware**

```typescript
describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    mockRequest = {};
    mockResponse = {
      setHeader: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it('should generate and attach request ID', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest['requestId']).toBeDefined();
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
    expect(nextFunction).toHaveBeenCalled();
  });
});
```

### Integration Testing

**Example: Testing middleware chain**

```typescript
describe('Middleware Integration', () => {
  it('should process request through all middleware', async () => {
    return request(app.getHttpServer())
      .get('/api/articles')
      .set('X-Tenant-ID', 'test-tenant')
      .expect(200)
      .expect((res) => {
        expect(res.headers['x-request-id']).toBeDefined();
      });
  });
});
```

---

## Best Practices

### 1. Middleware Order

- Always place RequestIdMiddleware first
- Place authentication middleware before tenant context
- Keep middleware lightweight and focused

### 2. Error Handling

```typescript
use(req: Request, res: Response, next: NextFunction) {
  try {
    // Middleware logic
    next();
  } catch (error) {
    next(error); // Pass errors to error handler
  }
}
```

### 3. Performance Considerations

- Avoid expensive operations in middleware
- Use async operations carefully
- Consider caching for tenant lookups

### 4. Security

- Validate tenant IDs to prevent injection
- Sanitize headers before processing
- Implement rate limiting per tenant

---

## Troubleshooting

### Common Issues

**1. Request ID not appearing in logs**

- Ensure RequestIdMiddleware is applied first
- Check that LoggerMiddleware accesses `req['requestId']`

**2. Tenant context not available**

- Verify `X-Tenant-ID` header is being sent
- Check AsyncLocalStorage is properly initialized
- Ensure middleware is applied to the route

**3. Performance degradation**

- Review middleware execution time
- Check for blocking operations
- Consider middleware order optimization

### Debug Mode

Enable debug logging:

```typescript
// In main.ts
app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);
```

---

## Future Enhancements

1. **Request Rate Limiting** - Add middleware for rate limiting per tenant
2. **Caching Layer** - Implement caching middleware for frequently accessed data
3. **Metrics Collection** - Add middleware to collect performance metrics
4. **Request Validation** - Add middleware for request schema validation
5. **Compression** - Add response compression middleware

---

## Related Documentation

- [NestJS Middleware Guide](https://docs.nestjs.com/middleware)
- [Multi-Tenancy Architecture](../docs/MULTI_TENANCY.md)
- [Logging Standards](../docs/LOGGING.md)
- [API Documentation](../docs/API.md)

---

## Support

For questions or issues related to middleware:

- Create an issue in the project repository
- Contact the development team
- Review the NestJS documentation

**Last Updated:** 2024
**Version:** 1.0.0
