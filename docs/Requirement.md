## 🎯 Project Goal

Build an **Enterprise Request Pipeline System** that demonstrates every phase of the NestJS request lifecycle through a practical API for a blog/content management system with role-based access control.

---

## 📋 Project Overview: "Content Hub API"

**Why This Project?**

- Naturally requires authentication, authorization, and validation
- Needs logging, caching, and transformation at different levels
- Perfect for demonstrating when to use Middleware vs Guards vs Interceptors vs Pipes
- Real-world scenarios for exception handling
- Clear testing boundaries

**Core Features:**

1. User authentication with JWT
2. Role-based content access (Admin, Editor, Viewer)
3. Article CRUD operations
4. Request logging and response transformation
5. Caching for frequently accessed articles
6. Rate limiting per user role
7. Input validation and sanitization

---

## 🏗️ Architecture Blueprint

### Request Flow (This is what you'll build):

```
Incoming Request
    ↓
1. MIDDLEWARE (tenant extraction, request ID, early validation)
    ↓
2. GUARDS (authentication, authorization, feature flags)
    ↓
3. INTERCEPTORS (Before) (logging, timing start, cache check)
    ↓
4. PIPES (validation, transformation, sanitization)
    ↓
5. ROUTE HANDLER (business logic)
    ↓
6. INTERCEPTORS (After) (response transformation, timing end, cache set)
    ↓
7. EXCEPTION FILTERS (error handling and formatting)
    ↓
Response
```

---

## 📦 Module Structure

```
src/
├── common/
│   ├── middleware/
│   │   ├── logger.middleware.ts
│   │   ├── request-id.middleware.ts
│   │   └── tenant-context.middleware.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── feature-flag.guard.ts
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   ├── cache.interceptor.ts
│   │   ├── response-transform.interceptor.ts
│   │   └── timeout.interceptor.ts
│   ├── pipes/
│   │   ├── validation.pipe.ts (custom)
│   │   ├── parse-mongo-id.pipe.ts
│   │   └── sanitization.pipe.ts
│   ├── filters/
│   │   ├── http-exception.filter.ts
│   │   ├── validation-exception.filter.ts
│   │   └── all-exceptions.filter.ts
│   └── decorators/
│       ├── roles.decorator.ts
│       ├── public.decorator.ts
│       └── current-user.decorator.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   └── dto/
│       ├── login.dto.ts
│       └── register.dto.ts
├── articles/
│   ├── articles.module.ts
│   ├── articles.controller.ts
│   ├── articles.service.ts
│   ├── entities/
│   │   └── article.entity.ts
│   └── dto/
│       ├── create-article.dto.ts
│       └── update-article.dto.ts
└── users/
    ├── users.module.ts
    ├── users.service.ts
    └── entities/
        └── user.entity.ts
```

---

## 🔧 Day-by-Day Implementation Plan

### **DAY 4: Middleware Layer**

**Learning Objectives:**

- Understand when to use middleware vs other lifecycle hooks
- Implement request context management
- Early request processing patterns

**What to Build:**

#### 1. Request ID Middleware

**Purpose:** Assign unique ID to each request for tracing
**Execution Order:** First
**Implementation Points:**

- Generate UUID for each request
- Attach to request object
- Add to response headers
- Log request ID

#### 2. Logger Middleware

**Purpose:** Log incoming requests
**Execution Order:** Second
**Implementation Points:**

- Log HTTP method, URL, user agent
- Log request body (sanitized)
- Calculate request processing time
- Log on request completion

#### 3. Tenant Context Middleware (Optional but recommended)

**Purpose:** Extract tenant information from subdomain/header
**Execution Order:** Third
**Implementation Points:**

- Parse subdomain from hostname
- Extract tenant ID from header
- Store in request context
- Handle missing tenant scenarios

**Testing Strategy:**

- Mock Express Request/Response
- Test middleware execution order
- Test request object modifications
- Test error scenarios

---

### **DAY 5: Guards & Authorization**

**Learning Objectives:**

- Understand guard execution order
- Implement authentication and authorization
- Learn when guards are better than middleware

**What to Build:**

#### 1. JWT Authentication Guard

**Purpose:** Verify user is authenticated
**Implementation Points:**

- Extend AuthGuard('jwt')
- Validate JWT token
- Attach user to request
- Handle expired tokens
- Handle missing tokens

#### 2. Roles Guard (Authorization)

**Purpose:** Check if user has required role
**Dependencies:** Requires authentication guard first
**Implementation Points:**

- Use Reflector to get required roles from metadata
- Compare user roles with required roles
- Support multiple roles (OR logic)
- Return clear error messages

#### 3. Feature Flag Guard

**Purpose:** Enable/disable features dynamically
**Implementation Points:**

- Check feature flag service
- Use Reflector for feature metadata
- Support environment-based flags
- Cache flag status

**Custom Decorators to Create:**

```typescript
@Roles('admin', 'editor')
@Public() // Skip auth guard
@RequireFeature('articles.create')
```

**Decision Matrix to Document:**

- When to use Guards vs Middleware?
- Guard execution order matters?
- Combining multiple guards

**Testing Strategy:**

- Mock ExecutionContext
- Test guard return values (true/false)
- Test with different user roles
- Test guard combinations

---

### **DAY 6: Interceptors & Pipes**

**Learning Objectives:**

- Understand interceptor execution (before/after)
- Master RxJS operators in interceptors
- Implement custom validation pipes

**What to Build:**

#### 1. Logging Interceptor

**Purpose:** Comprehensive request/response logging
**Implementation Points:**

- Log before handler execution
- Log after handler execution
- Calculate execution time
- Log response status and size
- Handle errors in logging

#### 2. Cache Interceptor

**Purpose:** Cache GET responses
**Implementation Points:**

- Check cache before handler
- Only cache GET requests
- Use Redis or in-memory cache
- Set TTL based on route
- Cache key generation strategy
- Handle cache misses

#### 3. Response Transform Interceptor

**Purpose:** Standardize all API responses
**Implementation Points:**

- Wrap response in standard format:

```typescript
{
  success: true,
  data: {...},
  timestamp: "...",
  requestId: "..."
}
```

- Handle pagination metadata
- Add execution time
- Preserve error responses

#### 4. Timeout Interceptor

**Purpose:** Prevent long-running requests
**Implementation Points:**

- Use RxJS timeout operator
- Configurable timeout per route
- Throw RequestTimeoutException
- Log timeout events

#### 5. Custom Validation Pipe

**Purpose:** Enhanced validation with sanitization
**Implementation Points:**

- Extend ValidationPipe
- Strip unknown properties
- Transform data types
- Custom error messages
- Sanitize HTML inputs

#### 6. Parse & Transform Pipes

**Purpose:** Transform route parameters
**Implementation Points:**

- ParseUUIDPipe for IDs
- Custom ParseDatePipe
- ParseBoolPipe for query params

**Testing Strategy:**

- Mock CallHandler and Observable
- Test RxJS operator chains
- Test interceptor before/after
- Test pipe transformations
- Test validation errors

---

### **DAY 7: Exception Filters & Integration**

**Learning Objectives:**

- Global vs controller-level exception handling
- Custom exception classes
- Error response standardization

**What to Build:**

#### 1. HTTP Exception Filter

**Purpose:** Handle all HTTP exceptions
**Implementation Points:**

- Catch HttpException
- Format error response consistently
- Include timestamp and requestId
- Log error details
- Different responses for dev/prod

#### 2. Validation Exception Filter

**Purpose:** Handle validation errors specifically
**Implementation Points:**

- Format class-validator errors
- Group errors by field
- Return clear error messages
- Include error codes

#### 3. All Exceptions Filter

**Purpose:** Catch-all for unexpected errors
**Implementation Points:**

- Handle unknown errors
- Log stack trace
- Hide sensitive info in production
- Return generic error message
- Alert on critical errors

#### 4. Custom Exception Classes

```typescript
-ArticleNotFoundException - UnauthorizedAccessException - RateLimitExceededException - InvalidTokenException;
```

**Integration Tasks:**

- Wire up all middleware in AppModule
- Apply global guards
- Apply global interceptors
- Apply global filters
- Apply global pipes

**Testing Strategy:**

- Test filter exception catching
- Test error response format
- Test filter precedence
- E2E tests for complete flow

---

## 🎯 API Endpoints to Implement

### Authentication Endpoints

```
POST   /auth/register          (Public)
POST   /auth/login             (Public)
POST   /auth/refresh           (Public)
GET    /auth/profile           (Authenticated)
```

### Article Endpoints

```
GET    /articles               (Public, Cached)
GET    /articles/:id           (Public, Cached)
POST   /articles               (Authenticated, Roles: editor, admin)
PUT    /articles/:id           (Authenticated, Roles: editor, admin)
DELETE /articles/:id           (Authenticated, Roles: admin)
POST   /articles/:id/publish   (Authenticated, Roles: admin, Feature: publish)
```

---

## 📊 Decision Matrix Document (Critical!)

Create a markdown document answering:

### 1. **Middleware vs Guards vs Interceptors vs Pipes**

| Concern          | Use         | Runs Before          | Access to        | Can Modify |
| ---------------- | ----------- | -------------------- | ---------------- | ---------- |
| Request logging  | Middleware  | Everything           | Request/Response | Request    |
| Authentication   | Guard       | Handler              | ExecutionContext | Nothing    |
| Response caching | Interceptor | Handler (both sides) | Observable       | Response   |
| Validation       | Pipe        | Handler              | Arguments        | Arguments  |

### 2. **Execution Order Diagram**

```
Request →
  Middleware (All) →
  Guards (All) →
  Interceptors (Before) →
  Pipes (Per param) →
  Handler →
  Interceptors (After) →
  Exception Filters (If error) →
  Response
```

### 3. **When to Use What?**

**Use Middleware when:**

- Early request processing needed
- Working with raw request/response
- Need to run before guards
- Third-party middleware integration

**Use Guards when:**

- Authentication/authorization
- Feature flags
- Need to completely block requests
- Need ExecutionContext metadata

**Use Interceptors when:**

- Need access to response
- Response transformation
- Logging with timing
- Caching

**Use Pipes when:**

- Input validation
- Data transformation
- Type conversion
- Sanitization

---

## 🧪 Testing Requirements (85% Coverage)

### Unit Tests Required:

**Middleware:**

- ✅ Request ID generation
- ✅ Logger output verification
- ✅ Tenant extraction scenarios

**Guards:**

- ✅ Authentication success/failure
- ✅ Role checking logic
- ✅ Feature flag evaluation
- ✅ Guard combinations

**Interceptors:**

- ✅ Logging before/after
- ✅ Cache hit/miss
- ✅ Response transformation
- ✅ Timeout scenarios

**Pipes:**

- ✅ Valid input transformation
- ✅ Invalid input rejection
- ✅ Sanitization effectiveness

**Filters:**

- ✅ Exception catching
- ✅ Response format
- ✅ Error logging

### Integration Tests:

- ✅ Complete request flow (E2E)
- ✅ Multiple guards together
- ✅ Interceptor + pipe interaction
- ✅ Filter error handling

---

## 📝 Deliverables Checklist

By end of Day 7, you should have:

✅ **Code:**

- [ ] 3 Middleware implementations
- [ ] 3 Guard implementations
- [ ] 4 Interceptor implementations
- [ ] 3 Pipe implementations
- [ ] 3 Exception filter implementations
- [ ] 5+ Custom decorators
- [ ] Complete auth module
- [ ] Complete articles module

✅ **Documentation:**

- [ ] Decision matrix (Markdown)
- [ ] Execution order diagram
- [ ] API documentation
- [ ] Architecture diagrams

✅ **Tests:**

- [ ] 85%+ code coverage
- [ ] All lifecycle hooks tested
- [ ] E2E test suite
- [ ] Test documentation

✅ **Working Features:**

- [ ] User registration/login
- [ ] JWT authentication
- [ ] Role-based access control
- [ ] Article CRUD operations
- [ ] Response caching
- [ ] Request logging
- [ ] Error handling

---

## 🚀 Getting Started (Step 1)

### Initial Setup Checklist:

```bash
# 1. Create new NestJS project
nest new content-hub-api

# 2. Install dependencies
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @nestjs/cache-manager cache-manager
npm install class-validator class-transformer
npm install uuid
npm install -D @types/passport-jwt @types/uuid

# 3. Create module structure
nest g module auth
nest g module articles
nest g module users
nest g module common

# 4. Create common folder structure manually
```

---

## 💡 Pro Tips

1. **Start with Day 4:** Build middleware first - they're easiest to understand
2. **Visualize:** Draw the request flow on paper before coding
3. **Test Early:** Write tests alongside implementation
4. **Log Everything:** You'll understand execution order better
5. **Use Postman:** Create a collection to test all scenarios
6. **Document Decisions:** Write down why you chose middleware over guard, etc.

---

## 🎓 Learning Outcomes

After completing this project, you'll understand:

✅ Complete NestJS request lifecycle
✅ When to use each lifecycle hook
✅ How to build scalable middleware pipelines
✅ Authentication and authorization patterns
✅ Response transformation strategies
✅ Caching strategies
✅ Error handling at different levels
✅ Testing strategies for each component

---

## 📚 Quick Reference During Development

**Need to:**

- Modify request before routing? → **Middleware**
- Block unauthorized requests? → **Guard**
- Transform response? → **Interceptor**
- Validate input? → **Pipe**
- Handle errors? → **Exception Filter**

---

This specification gives you the complete blueprint. You'll code everything yourself, but this serves as your roadmap. Each day builds on the previous, and by Day 7, you'll have a production-grade request pipeline system.

**Ready to start Day 4?** Begin with the Request ID Middleware - it's the simplest and will help you understand the middleware pattern before moving to more complex guards and interceptors.
