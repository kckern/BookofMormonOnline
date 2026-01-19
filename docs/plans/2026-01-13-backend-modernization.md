# Backend Modernization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize the Node.js/TypeScript backend to follow current best practices for security, type safety, maintainability, and performance.

**Architecture:** Phased approach starting with critical security fixes, then type safety improvements, followed by architectural refactoring. Each phase is independent and can be deployed separately. Uses existing bcryptjs dependency (already installed but unused).

**Tech Stack:** Node.js, TypeScript 5.x (strict mode), Express, Apollo GraphQL, Sequelize 6, MySQL, Redis, Socket.io, Jest, Zod validation

---

## Regression Test Baseline

**IMPORTANT:** Before starting and after each phase, verify the regression test suite passes:

```bash
npm run test:regression
```

**Expected:** 42 tests passing across 5 test suites:
- `content.test.ts` - 10 tests (division, page, section, text, lookup, search)
- `scripture.test.ts` - 5 tests (scripture refs, verses, read blocks, highlights)
- `people-places.test.ts` - 7 tests (person, place, maps, mapstories, timeline)
- `notes.test.ts` - 8 tests (commentary, publications, images, chiasmus, history)
- `utils.test.ts` - 12 tests (labels, menu, markdown, shortlinks, search, tokens)

These tests serve as the **baseline** - all 42 must pass after every phase.

---

## Phase 1: Critical Security Fixes

### Task 1.1: Replace MD5 Password Hashing with bcrypt

**Files:**
- Modify: `src/resolvers/BomUser.ts:53-57` (md5 function)
- Modify: `src/resolvers/BomUser.ts:84-87` (signin password check)
- Modify: `src/resolvers/BomUser.ts` (signup password hashing)
- Create: `src/library/auth/password.ts`

**Step 1: Create password utility module**

Create `src/library/auth/password.ts`:
```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  // Support legacy MD5 hashes during migration
  if (hash.length === 32 && /^[a-f0-9]+$/.test(hash)) {
    const crypto = await import('crypto');
    const md5Hash = crypto.createHash('md5').update(password, 'utf8').digest('hex');
    return md5Hash === hash;
  }
  return bcrypt.compare(password, hash);
};

export const needsRehash = (hash: string): boolean => {
  // MD5 hashes are 32 hex characters
  return hash.length === 32 && /^[a-f0-9]+$/.test(hash);
};
```

**Step 2: Run regression tests (baseline)**

Run: `npm run test:regression`
Expected: 42 tests pass (baseline verification)

**Step 3: Update signin resolver to use new password module**

Modify `src/resolvers/BomUser.ts` signin function:
```typescript
import { verifyPassword, hashPassword, needsRehash } from '../library/auth/password';

// In signin resolver, replace:
const passwordHash = crypto.createHash('md5').update(args.password).digest('hex');

// With:
const user = await Models.BomUser.findOne({
  where: {
    [Op.or]: { user: args.username, email: args.username }
  }
});

if (!user) {
  return { isSuccess: false, msg: 'Login Failed', user: null };
}

const storedHash = user.getDataValue('pass');
const isValid = await verifyPassword(args.password, storedHash);

if (!isValid) {
  return { isSuccess: false, msg: 'Login Failed', user: null };
}

// Rehash if using legacy MD5
if (needsRehash(storedHash)) {
  const newHash = await hashPassword(args.password);
  await user.update({ pass: newHash });
}
```

**Step 4: Run regression tests to verify signin still works**

Run: `npm run test:regression`
Expected: 42 tests PASS

**Step 5: Commit security fix**

```bash
git add src/library/auth/password.ts src/resolvers/BomUser.ts
git commit -m "security: replace MD5 password hashing with bcrypt

- Add password utility with bcrypt hashing
- Support legacy MD5 hashes during migration
- Auto-rehash on successful login
- BREAKING: New passwords use bcrypt (60 char hashes)"
```

---

### Task 1.2: Fix SQL Injection Vulnerabilities

**Files:**
- Modify: `src/api/mapmarkers.ts`
- Modify: `src/api/studybuddy.ts`
- Modify: `src/library/db/index.ts`

**Step 1: Audit SQL injection points**

Search for template literal SQL:
```bash
grep -r "SELECT.*\${" src/ --include="*.ts"
grep -r "WHERE.*\${" src/ --include="*.ts"
```

**Step 2: Fix mapmarkers.ts SQL injection**

Replace in `src/api/mapmarkers.ts`:
```typescript
// BEFORE (vulnerable):
const placeDataResults = await queryDB(`SELECT * FROM bom_places WHERE slug = '${slug}'`);

// AFTER (safe):
const placeDataResults = await queryDB(
  `SELECT * FROM bom_places WHERE slug = ?`,
  [slug]
);
```

**Step 3: Fix studybuddy.ts SQL injection**

Replace in `src/api/studybuddy.ts`:
```typescript
// BEFORE (vulnerable):
let sql = `SELECT * FROM bom_people WHERE slug IN (${people_slugs.map((slug) => `"${slug}"`).join(",")})`;

// AFTER (safe):
const placeholders = people_slugs.map(() => '?').join(',');
let sql = `SELECT * FROM bom_people WHERE slug IN (${placeholders})`;
const results = await queryDB(sql, people_slugs);
```

**Step 4: Add SQL injection test**

Create `test/security/sql-injection.test.ts`:
```typescript
describe('SQL Injection Prevention', () => {
  it('should escape malicious slugs in mapmarkers', async () => {
    const maliciousSlug = "'; DROP TABLE bom_places; --";
    // Test should not throw and should return empty results
    const result = await getMapMarker(maliciousSlug);
    expect(result).toBeNull();
  });
});
```

**Step 5: Run security tests**

Run: `npm test -- --testPathPattern=security`
Expected: PASS

**Step 6: Commit SQL injection fixes**

```bash
git add src/api/mapmarkers.ts src/api/studybuddy.ts test/security/
git commit -m "security: fix SQL injection vulnerabilities

- Use parameterized queries in mapmarkers.ts
- Use parameterized queries in studybuddy.ts
- Add SQL injection prevention tests"
```

---

### Task 1.3: Move Hardcoded Secrets to Environment

**Files:**
- Modify: `src/api/index.ts:24-31` (bot IDs)
- Modify: `src/index.ts:63-67` (CORS origins)
- Modify: `src/config/apollo.ts:7` (languages)
- Create: `.env.example`

**Step 1: Create .env.example with all required variables**

Create `.env.example`:
```bash
# Database
MYSQL_DB=bookofmormon
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_HOST=
MYSQL_PORT=3306

# Pool Configuration
DB_POOL_ACQUIRE=60000
DB_POOL_IDLE=30000
DB_POOL_MAX_CONN=8
DB_POOL_MIN_CONN=4

# Feature Flags
MESSENGER_ENABLED=false

# Security
CORS_ALLOWED_ORIGINS=localhost,bookofmormon.online
STUDYBUDDY_BOT_IDS=

# Supported Languages
SUPPORTED_LANGUAGES=en,fr,de,nl,pt,ko,jpn,zh,ru,hi,eo,es,vn,tgl,th,ukr,tam,swe
```

**Step 2: Update CORS configuration**

Modify `src/index.ts`:
```typescript
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'localhost')
  .split(',')
  .map(s => s.trim());
```

**Step 3: Update bot ID configuration**

Modify `src/api/index.ts`:
```typescript
const studyBuddyIds = (process.env.STUDYBUDDY_BOT_IDS || '')
  .split(',')
  .filter(Boolean);
```

**Step 4: Update language configuration**

Modify `src/config/apollo.ts`:
```typescript
const langs = (process.env.SUPPORTED_LANGUAGES || 'en')
  .split(',')
  .map(s => s.trim());
```

**Step 5: Commit configuration externalization**

```bash
git add .env.example src/index.ts src/api/index.ts src/config/apollo.ts
git commit -m "config: externalize hardcoded values to environment

- Move CORS origins to CORS_ALLOWED_ORIGINS env var
- Move bot IDs to STUDYBUDDY_BOT_IDS env var
- Move supported languages to SUPPORTED_LANGUAGES env var
- Add .env.example template"
```

---

## Phase 2: TypeScript Strict Mode & Type Safety

### Task 2.1: Enable TypeScript Strict Mode

**Files:**
- Modify: `tsconfig.json`
- Modify: `tsconfig.build.json`

**Step 1: Create strict TypeScript configuration**

Modify `tsconfig.build.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

**Step 2: Run TypeScript compiler to identify errors**

Run: `npx tsc --noEmit 2>&1 | head -100`
Expected: Multiple type errors (this is expected, will fix in subsequent tasks)

**Step 3: Document error count baseline**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Document the number for tracking progress.

**Step 4: Commit strict mode config (errors expected)**

```bash
git add tsconfig.json tsconfig.build.json
git commit -m "typescript: enable strict mode

- Enable strict, strictNullChecks, noImplicitAny
- Note: Type errors expected, will fix incrementally"
```

---

### Task 2.2: Create GraphQL Context Types

**Files:**
- Create: `src/types/graphql.ts`
- Modify: `src/types.ts`

**Step 1: Create GraphQL type definitions**

Create `src/types/graphql.ts`:
```typescript
import { Request, Response } from 'express';
import { GraphQLResolveInfo } from 'graphql';

export interface GraphQLContext {
  req: Request;
  res: Response;
  lang: string;
  ip: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export type ResolverFn<TResult, TParent = unknown, TArgs = Record<string, unknown>> = (
  parent: TParent,
  args: TArgs,
  context: GraphQLContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

// Common argument types
export interface PaginationArgs {
  limit?: number;
  offset?: number;
}

export interface SlugArgs {
  slug: string;
}

export interface IdArgs {
  id: string | number;
}

// Response types
export interface AuthResponse {
  isSuccess: boolean;
  msg: string;
  user: UserData | null;
}

export interface UserData {
  id: string;
  user: string;
  name: string;
  email: string;
  token: string;
  social: string[];
  progress: number;
}
```

**Step 2: Update types.ts to export new types**

Modify `src/types.ts`:
```typescript
export * from './types/graphql';
```

**Step 3: Commit GraphQL types**

```bash
git add src/types/graphql.ts src/types.ts
git commit -m "types: add GraphQL context and resolver types

- Add GraphQLContext interface
- Add ResolverFn generic type
- Add common argument types (Pagination, Slug, Id)
- Add AuthResponse type"
```

---

### Task 2.3: Type BomUser Resolver

**Files:**
- Modify: `src/resolvers/BomUser.ts`

**Step 1: Add type imports**

Add to top of `src/resolvers/BomUser.ts`:
```typescript
import { GraphQLContext, ResolverFn, AuthResponse, UserData } from '../types/graphql';
```

**Step 2: Define argument interfaces**

Add after imports:
```typescript
interface SigninArgs {
  username: string;
  password: string;
  token: string;
}

interface SignupArgs {
  username: string;
  email: string;
  password: string;
  token: string;
}

interface CheckUsernameArgs {
  username: string;
}
```

**Step 3: Type the signin resolver**

Replace:
```typescript
signin: async (root: any, args: any, context: any, info: any) => {
```

With:
```typescript
signin: async (
  _root: unknown,
  args: SigninArgs,
  context: GraphQLContext,
  _info: unknown
): Promise<AuthResponse> => {
```

**Step 4: Run type check**

Run: `npx tsc --noEmit src/resolvers/BomUser.ts 2>&1 | head -50`
Expected: Fewer errors than before

**Step 5: Commit typed resolver**

```bash
git add src/resolvers/BomUser.ts
git commit -m "types: add type safety to BomUser resolver

- Add SigninArgs, SignupArgs interfaces
- Type signin resolver with proper generics
- Replace 'any' with specific types"
```

---

### Task 2.4: Create Input Validation with Zod

**Files:**
- Create: `src/library/validation/schemas.ts`
- Create: `src/library/validation/index.ts`
- Modify: `package.json` (add zod)

**Step 1: Install Zod**

Run: `npm install zod`

**Step 2: Create validation schemas**

Create `src/library/validation/schemas.ts`:
```typescript
import { z } from 'zod';

export const SigninSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(100),
  token: z.string().min(1)
});

export const SignupSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, dots, underscores, and hyphens'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters'),
  token: z.string().min(1)
});

export const SlugSchema = z.object({
  slug: z.string().min(1).max(200)
});

export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0)
});

export type SigninInput = z.infer<typeof SigninSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
```

**Step 3: Create validation utility**

Create `src/library/validation/index.ts`:
```typescript
import { ZodSchema, ZodError } from 'zod';

export class ValidationError extends Error {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(zodError: ZodError) {
    const errors = zodError.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    super(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error);
  }
  return result.data;
}

export * from './schemas';
```

**Step 4: Run regression tests**

Run: `npm run test:regression`
Expected: 42 tests PASS

**Step 5: Commit validation library**

```bash
git add package.json package-lock.json src/library/validation/
git commit -m "feat: add Zod input validation library

- Add validation schemas for signin, signup, slug, pagination
- Add ValidationError class with structured errors
- Add validate() utility function"
```

---

## Phase 3: Error Handling & Logging

### Task 3.1: Create Custom Error Classes

**Files:**
- Create: `src/library/errors/index.ts`
- Create: `src/library/errors/AppError.ts`
- Create: `src/library/errors/types.ts`

**Step 1: Create error types**

Create `src/library/errors/types.ts`:
```typescript
export enum ErrorCode {
  // Authentication
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Resources
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',

  // Database
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',

  // External Services
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Generic
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST'
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}
```

**Step 2: Create base AppError class**

Create `src/library/errors/AppError.ts`:
```typescript
import { ErrorCode, ErrorDetails } from './types';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(ErrorCode.UNAUTHORIZED, message, 401);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(ErrorCode.NOT_FOUND, `${resource} not found`, 404);
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(ErrorCode.DATABASE_ERROR, message, 500);
  }
}
```

**Step 3: Create error index**

Create `src/library/errors/index.ts`:
```typescript
export * from './types';
export * from './AppError';
```

**Step 4: Commit error classes**

```bash
git add src/library/errors/
git commit -m "feat: add custom error classes

- Add ErrorCode enum with categorized codes
- Add AppError base class with serialization
- Add AuthenticationError, ValidationError, NotFoundError
- Add DatabaseError for database failures"
```

---

### Task 3.2: Implement Structured Logging

**Files:**
- Modify: `src/library/utils/logger.ts`
- Create: `src/library/utils/requestLogger.ts`

**Step 1: Enhance logger with structured logging**

Modify `src/library/utils/logger.ts`:
```typescript
import winston from 'winston';
import 'winston-syslog';

const { PAPERTRAIL_HOST, PAPERTRAIL_PORT, NODE_ENV, LOG_LEVEL } = process.env;

const formatMeta = (meta: Record<string, unknown>) => {
  const cleaned = { ...meta };
  delete cleaned.level;
  delete cleaned.message;
  delete cleaned.timestamp;
  return Object.keys(cleaned).length ? JSON.stringify(cleaned) : '';
};

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = formatMeta(meta);
    return `${timestamp} ${level}: ${message}${metaStr ? ` ${metaStr}` : ''}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
    level: LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug')
  })
];

if (PAPERTRAIL_HOST && PAPERTRAIL_PORT) {
  transports.push(
    new (winston.transports as any).Syslog({
      host: PAPERTRAIL_HOST,
      port: parseInt(PAPERTRAIL_PORT, 10),
      protocol: 'tls4',
      localhost: 'bom-api',
      app_name: 'bookofmormon',
      format: winston.format.json()
    })
  );
}

export const logger = winston.createLogger({
  level: LOG_LEVEL || 'info',
  defaultMeta: { service: 'bom-api' },
  transports
});

// Convenience methods with context
export const logInfo = (message: string, meta?: Record<string, unknown>) =>
  logger.info(message, meta);

export const logError = (message: string, error?: Error, meta?: Record<string, unknown>) =>
  logger.error(message, { error: error?.message, stack: error?.stack, ...meta });

export const logWarn = (message: string, meta?: Record<string, unknown>) =>
  logger.warn(message, meta);

export const logDebug = (message: string, meta?: Record<string, unknown>) =>
  logger.debug(message, meta);

export default logger;
```

**Step 2: Create request logging middleware**

Create `src/library/utils/requestLogger.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { nanoid } from 'nanoid';

export interface RequestWithId extends Request {
  requestId: string;
}

export const requestIdMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  (req as RequestWithId).requestId = req.headers['x-request-id'] as string || nanoid(12);
  next();
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = (req as RequestWithId).requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });

  next();
};
```

**Step 3: Commit logging improvements**

```bash
git add src/library/utils/logger.ts src/library/utils/requestLogger.ts
git commit -m "feat: implement structured logging

- Add structured JSON logging format
- Add request ID middleware for tracing
- Add HTTP request logging middleware
- Add convenience logging functions with context"
```

---

### Task 3.3: Add GraphQL Error Handling

**Files:**
- Create: `src/config/errorHandler.ts`
- Modify: `src/config/apollo.ts`

**Step 1: Create GraphQL error handler**

Create `src/config/errorHandler.ts`:
```typescript
import { GraphQLError } from 'graphql';
import { AppError, ErrorCode } from '../library/errors';
import { logError } from '../library/utils/logger';

export const formatGraphQLError = (error: GraphQLError): GraphQLError => {
  const originalError = error.originalError;

  // Log the error
  logError('GraphQL Error', originalError || new Error(error.message), {
    path: error.path,
    locations: error.locations
  });

  // If it's our custom error, preserve the code
  if (originalError instanceof AppError) {
    return new GraphQLError(originalError.message, {
      extensions: {
        code: originalError.code,
        details: originalError.details
      }
    });
  }

  // For unexpected errors, return generic message in production
  if (process.env.NODE_ENV === 'production') {
    return new GraphQLError('An unexpected error occurred', {
      extensions: { code: ErrorCode.INTERNAL_ERROR }
    });
  }

  // In development, include full error details
  return error;
};
```

**Step 2: Update Apollo config**

Add to `src/config/apollo.ts`:
```typescript
import { formatGraphQLError } from './errorHandler';

// In apolloConfig options:
formatError: formatGraphQLError,
```

**Step 3: Commit error handling**

```bash
git add src/config/errorHandler.ts src/config/apollo.ts
git commit -m "feat: add GraphQL error handling

- Add formatGraphQLError for consistent error responses
- Log errors with context
- Hide internal errors in production
- Preserve custom error codes"
```

---

## Phase 4: Code Organization & Service Layer

### Task 4.1: Create Authentication Service

**Files:**
- Create: `src/services/AuthService.ts`
- Create: `src/services/index.ts`

**Step 1: Create AuthService**

Create `src/services/AuthService.ts`:
```typescript
import { models } from '../config/database';
import { hashPassword, verifyPassword, needsRehash } from '../library/auth/password';
import { validate, SigninSchema, SignupSchema } from '../library/validation';
import { AuthenticationError, ValidationError, NotFoundError } from '../library/errors';
import { logInfo, logWarn } from '../library/utils/logger';
import { Op } from 'sequelize';

export interface AuthResult {
  success: boolean;
  message: string;
  user: UserDTO | null;
}

export interface UserDTO {
  id: string;
  username: string;
  email: string;
  name: string;
  token: string;
}

export class AuthService {
  async signin(username: string, password: string, token: string): Promise<AuthResult> {
    // Validate input
    const input = validate(SigninSchema, { username, password, token });

    // Find user
    const user = await models.BomUser.findOne({
      where: {
        [Op.or]: { user: input.username, email: input.username }
      }
    });

    if (!user) {
      logWarn('Signin failed - user not found', { username: input.username });
      return { success: false, message: 'Invalid credentials', user: null };
    }

    // Verify password
    const storedHash = user.getDataValue('pass');
    const isValid = await verifyPassword(input.password, storedHash);

    if (!isValid) {
      logWarn('Signin failed - invalid password', { username: input.username });
      return { success: false, message: 'Invalid credentials', user: null };
    }

    // Rehash if using legacy MD5
    if (needsRehash(storedHash)) {
      const newHash = await hashPassword(input.password);
      await user.update({ pass: newHash });
      logInfo('Password rehashed for user', { username: input.username });
    }

    logInfo('User signed in', { username: input.username });

    return {
      success: true,
      message: 'Login successful',
      user: this.toUserDTO(user)
    };
  }

  async signup(username: string, email: string, password: string, token: string): Promise<AuthResult> {
    // Validate input
    const input = validate(SignupSchema, { username, email, password, token });

    // Check if username or email exists
    const existing = await models.BomUser.findOne({
      where: {
        [Op.or]: { user: input.username, email: input.email }
      }
    });

    if (existing) {
      const field = existing.getDataValue('user') === input.username ? 'username' : 'email';
      return { success: false, message: `${field} already exists`, user: null };
    }

    // Hash password and create user
    const passwordHash = await hashPassword(input.password);

    const user = await models.BomUser.create({
      user: input.username,
      email: input.email,
      pass: passwordHash,
      name: input.username
    });

    logInfo('User created', { username: input.username });

    return {
      success: true,
      message: 'Account created',
      user: this.toUserDTO(user)
    };
  }

  private toUserDTO(user: any): UserDTO {
    return {
      id: user.getDataValue('id'),
      username: user.getDataValue('user'),
      email: user.getDataValue('email'),
      name: user.getDataValue('name'),
      token: user.getDataValue('token') || ''
    };
  }
}

export const authService = new AuthService();
```

**Step 2: Create services index**

Create `src/services/index.ts`:
```typescript
export { AuthService, authService } from './AuthService';
```

**Step 3: Commit authentication service**

```bash
git add src/services/
git commit -m "feat: create AuthService layer

- Extract authentication logic from resolver
- Add signin with validation and logging
- Add signup with duplicate checking
- Add password rehashing on login"
```

---

### Task 4.2: Refactor BomUser Resolver to Use Service

**Files:**
- Modify: `src/resolvers/BomUser.ts`

**Step 1: Update resolver to use AuthService**

Update signin in `src/resolvers/BomUser.ts`:
```typescript
import { authService } from '../services';

export default {
  Query: {
    signin: async (
      _root: unknown,
      args: SigninArgs,
      context: GraphQLContext
    ): Promise<AuthResponse> => {
      const result = await authService.signin(
        args.username,
        args.password,
        args.token
      );

      return {
        isSuccess: result.success,
        msg: result.message,
        user: result.user ? {
          id: result.user.id,
          user: result.user.username,
          name: result.user.name,
          email: result.user.email,
          token: result.user.token,
          social: [],
          progress: 0
        } : null
      };
    },
    // ... rest of resolvers
  }
};
```

**Step 2: Run regression tests**

Run: `npm run test:regression`
Expected: 42 tests PASS

**Step 3: Commit refactored resolver**

```bash
git add src/resolvers/BomUser.ts
git commit -m "refactor: use AuthService in BomUser resolver

- Delegate signin to AuthService
- Remove duplicated auth logic from resolver
- Resolver now thin wrapper around service"
```

---

### Task 4.3: Split Database Configuration

**Files:**
- Create: `src/config/database/connection.ts`
- Create: `src/config/database/models.ts`
- Create: `src/config/database/index.ts`
- Rename: `src/config/database.ts` -> backup

**Step 1: Create connection module**

Create `src/config/database/connection.ts`:
```typescript
import { Sequelize } from 'sequelize';
import { logInfo, logWarn, logError } from '../../library/utils/logger';

const {
  MYSQL_DB,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_HOST,
  MYSQL_PORT,
  DB_POOL_ACQUIRE,
  DB_POOL_IDLE,
  DB_POOL_MAX_CONN,
  DB_POOL_MIN_CONN
} = process.env;

export const sequelize = new Sequelize(
  MYSQL_DB!,
  MYSQL_USER!,
  MYSQL_PASSWORD!,
  {
    dialect: 'mysql',
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT) || 3306,
    logging: false,
    pool: {
      acquire: Number(DB_POOL_ACQUIRE) || 60000,
      idle: Number(DB_POOL_IDLE) || 30000,
      max: Number(DB_POOL_MAX_CONN) || 8,
      min: Number(DB_POOL_MIN_CONN) || 4,
      evict: 10000
    },
    define: {
      timestamps: false,
      freezeTableName: true
    },
    retry: {
      max: 3,
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ]
    }
  }
);

export const initializeDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logInfo('Database connection established');
  } catch (error) {
    logError('Database connection failed', error as Error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  await sequelize.close();
  logInfo('Database connection closed');
};
```

**Step 2: Create models registry**

Create `src/config/database/models.ts`:
```typescript
import { sequelize } from './connection';
import { Models } from '../../database/typings/Models';

// Import all models
import BomUser from '../../database/models/bom_user';
import BomLog from '../../database/models/bom_log';
// ... (import all other models from original file)

export const initializeModels = (): Models => {
  const models: Models = {
    BomUser: BomUser.initModel(sequelize),
    BomLog: BomLog.initModel(sequelize),
    // ... (initialize all models)
  };

  // Setup associations
  Object.values(models).forEach(model => {
    if (typeof model.associate === 'function') {
      model.associate(models);
    }
  });

  return models;
};

export let models: Models;

export const getModels = (): Models => {
  if (!models) {
    models = initializeModels();
  }
  return models;
};
```

**Step 3: Create database index**

Create `src/config/database/index.ts`:
```typescript
export { sequelize, initializeDatabase, closeDatabase } from './connection';
export { models, getModels, initializeModels } from './models';
```

**Step 4: Commit database split**

```bash
git add src/config/database/
git commit -m "refactor: split database config into modules

- Extract connection logic to connection.ts
- Extract model initialization to models.ts
- Add proper initialization functions
- Improve separation of concerns"
```

---

## Phase 5: Performance Improvements

### Task 5.1: Implement DataLoader for N+1 Prevention

**Files:**
- Create: `src/library/dataloaders/index.ts`
- Create: `src/library/dataloaders/userLoader.ts`

**Step 1: Install DataLoader**

Run: `npm install dataloader`

**Step 2: Create user DataLoader**

Create `src/library/dataloaders/userLoader.ts`:
```typescript
import DataLoader from 'dataloader';
import { models } from '../../config/database';
import { Op } from 'sequelize';

export const createUserLoader = () => new DataLoader<string, any>(
  async (userIds) => {
    const users = await models.BomUser.findAll({
      where: { id: { [Op.in]: userIds as string[] } }
    });

    const userMap = new Map(users.map(u => [u.getDataValue('id'), u]));
    return userIds.map(id => userMap.get(id) || null);
  },
  { cache: true }
);

export type UserLoader = ReturnType<typeof createUserLoader>;
```

**Step 3: Create DataLoader index**

Create `src/library/dataloaders/index.ts`:
```typescript
import { createUserLoader, UserLoader } from './userLoader';

export interface DataLoaders {
  userLoader: UserLoader;
}

export const createDataLoaders = (): DataLoaders => ({
  userLoader: createUserLoader()
});

export { createUserLoader } from './userLoader';
```

**Step 4: Add loaders to GraphQL context**

Update `src/config/apollo.ts`:
```typescript
import { createDataLoaders } from '../library/dataloaders';

// In context function:
context: ({ req, res }) => ({
  req,
  res,
  lang: detectLanguage(req),
  ip: getIpAddress(req),
  loaders: createDataLoaders()
})
```

**Step 5: Commit DataLoader**

```bash
git add package.json package-lock.json src/library/dataloaders/ src/config/apollo.ts
git commit -m "perf: add DataLoader for N+1 query prevention

- Add DataLoader library
- Create userLoader for batching user queries
- Add loaders to GraphQL context
- Loaders created per-request for proper caching"
```

---

### Task 5.2: Add Query Depth Limiting

**Files:**
- Modify: `src/config/apollo.ts`

**Step 1: Install depth limit plugin**

Run: `npm install graphql-depth-limit`

**Step 2: Add depth limiting to Apollo**

Update `src/config/apollo.ts`:
```typescript
import depthLimit from 'graphql-depth-limit';

// In Apollo Server config:
validationRules: [depthLimit(10)]
```

**Step 3: Commit depth limiting**

```bash
git add package.json package-lock.json src/config/apollo.ts
git commit -m "perf: add GraphQL query depth limiting

- Add graphql-depth-limit package
- Limit query depth to 10 levels
- Prevents DoS via deeply nested queries"
```

---

## Phase 6: Testing Infrastructure

### Task 6.1: Setup Jest with TypeScript

**Files:**
- Create: `jest.config.js`
- Create: `test/setup.ts`

**Step 1: Create Jest configuration**

Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/database/models/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  verbose: true
};
```

**Step 2: Create test setup**

Create `test/setup.ts`:
```typescript
import dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.test' });

// Set test timeout
jest.setTimeout(30000);

// Mock console during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
// };
```

**Step 3: Commit Jest setup**

```bash
git add jest.config.js test/setup.ts
git commit -m "test: setup Jest with TypeScript

- Add jest.config.js with ts-jest
- Add test setup file
- Configure coverage collection"
```

---

### Task 6.2: Add AuthService Unit Tests

**Files:**
- Create: `test/services/AuthService.test.ts`

**Step 1: Create AuthService tests**

Create `test/services/AuthService.test.ts`:
```typescript
import { AuthService } from '../../src/services/AuthService';
import { models } from '../../src/config/database';
import { hashPassword } from '../../src/library/auth/password';

// Mock the database models
jest.mock('../../src/config/database', () => ({
  models: {
    BomUser: {
      findOne: jest.fn(),
      create: jest.fn()
    }
  }
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('signin', () => {
    it('should return failure for invalid credentials', async () => {
      (models.BomUser.findOne as jest.Mock).mockResolvedValue(null);

      const result = await authService.signin('unknown', 'password', 'token');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
    });

    it('should return success for valid credentials', async () => {
      const passwordHash = await hashPassword('password123');
      const mockUser = {
        getDataValue: jest.fn((field: string) => {
          const data: Record<string, string> = {
            id: '1',
            user: 'testuser',
            email: 'test@example.com',
            name: 'Test User',
            pass: passwordHash
          };
          return data[field];
        }),
        update: jest.fn()
      };

      (models.BomUser.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.signin('testuser', 'password123', 'token');

      expect(result.success).toBe(true);
      expect(result.user).toBeTruthy();
      expect(result.user?.username).toBe('testuser');
    });
  });

  describe('signup', () => {
    it('should fail for duplicate username', async () => {
      const mockUser = {
        getDataValue: jest.fn().mockReturnValue('existinguser')
      };
      (models.BomUser.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.signup(
        'existinguser',
        'new@example.com',
        'password123',
        'token'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should create user for valid input', async () => {
      (models.BomUser.findOne as jest.Mock).mockResolvedValue(null);

      const mockCreatedUser = {
        getDataValue: jest.fn((field: string) => {
          const data: Record<string, string> = {
            id: '2',
            user: 'newuser',
            email: 'new@example.com',
            name: 'newuser'
          };
          return data[field];
        })
      };
      (models.BomUser.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const result = await authService.signup(
        'newuser',
        'new@example.com',
        'password123',
        'token'
      );

      expect(result.success).toBe(true);
      expect(result.user?.username).toBe('newuser');
    });
  });
});
```

**Step 2: Run tests**

Run: `npm test -- --testPathPattern=AuthService`
Expected: PASS

**Step 3: Commit tests**

```bash
git add test/services/AuthService.test.ts
git commit -m "test: add AuthService unit tests

- Add signin tests for valid/invalid credentials
- Add signup tests for duplicate checking
- Add signup tests for user creation
- Mock database models for isolation"
```

---

## Summary

### Completed Phases:

| Phase | Focus | Tasks |
|-------|-------|-------|
| 1 | Security | Password hashing, SQL injection, secrets management |
| 2 | Type Safety | Strict mode, GraphQL types, validation |
| 3 | Error Handling | Custom errors, structured logging, GraphQL errors |
| 4 | Architecture | Service layer, database split, resolver refactoring |
| 5 | Performance | DataLoader, query depth limiting |
| 6 | Testing | Jest setup, unit tests |

### Key Improvements:

1. **Security**: bcrypt passwords, parameterized queries, externalized secrets
2. **Type Safety**: TypeScript strict mode, Zod validation, typed resolvers
3. **Maintainability**: Service layer, modular database config, custom errors
4. **Performance**: DataLoader batching, query depth limits
5. **Observability**: Structured logging, error tracking
6. **Quality**: Jest testing infrastructure, unit tests

### Migration Notes:

- Password migration is automatic (rehash on login)
- Existing tests should continue to pass
- Each phase can be deployed independently
- Monitor logs during rollout for any issues
