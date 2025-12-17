import { Injectable, NestInterceptor, ExecutionContext, Logger, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const CACHE_CONFIG: Record<string, number> = {
  '/api/users': 300, // 5 minutes
  '/api/products': 600, // 10 minutes
  '/api/categories': 1800, // 30 minutes
  default: 60, // 1 minute
};

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger('CacheInterceptor');
  private inMemoryCache: Map<string, CacheEntry> = new Map<string, CacheEntry>();

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    const cacheKey = this.generateCacheKey(request);
    const ttl = this.getTTLForRoute(request.path);

    try {
      // Check cache first
      const cachedData = await this.getFromCache(cacheKey);

      if (cachedData) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return of(cachedData);
      }

      this.logger.debug(`Cache MISS: ${cacheKey}`);
    } catch (error) {
      this.logger.warn(`Cache lookup error for ${cacheKey}:`, error.message);
    }

    // Cache miss - proceed with handler
    return next.handle().pipe(
      tap((response) => {
        void (async () => {
          try {
            // Cache the response
            await this.setCache(cacheKey, response, ttl);
            this.logger.debug(`Cached response for ${cacheKey} (TTL: ${ttl}s)`);
          } catch (error) {
            this.logger.warn(`Failed to cache ${cacheKey}:`, error.message);
          }
        })();
      }),
    );
  }

  private generateCacheKey(request: Request): string {
    const queryString = Object.keys(request.query)
      .sort()
      .map((key) => {
        const value = request.query[key];
        const stringValue = Array.isArray(value)
          ? value.map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))).join(',')
          : typeof value === 'object' && value !== null
            ? JSON.stringify(value)
            : String(value ?? '');
        return `${key}=${stringValue}`;
      })
      .join('&');

    const key = queryString ? `${request.path}?${queryString}` : request.path;

    // Hash the key if it's too long
    if (key.length > 200) {
      return `cache:${this.simpleHash(key)}`;
    }

    return `cache:${key}`;
  }

  private getTTLForRoute(path: string): number {
    for (const [route, ttl] of Object.entries(CACHE_CONFIG)) {
      if (path.startsWith(route)) {
        return ttl;
      }
    }
    return CACHE_CONFIG.default;
  }

  private async getFromCache(key: string): Promise<unknown> {
    // Try in-memory cache first (fastest)
    const inMemory = this.inMemoryCache.get(key);
    if (inMemory && !this.isExpired(inMemory)) {
      return inMemory.data;
    }

    // Try Redis cache
    const cached = await this.cacheManager.get<any>(key);
    if (cached) {
      // Refresh in-memory cache
      this.inMemoryCache.set(key, {
        data: cached,
        timestamp: Date.now(),
        ttl: CACHE_CONFIG.default,
      });
      return cached;
    }

    return null;
  }

  private async setCache(key: string, data: any, ttl: number): Promise<void> {
    // Set in-memory cache
    this.inMemoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Set Redis cache (if available)
    try {
      await this.cacheManager.set(key, data, ttl * 1000);
    } catch (error) {
      this.logger.warn(`Redis cache set failed for ${key}:`, error.message);
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    const age = (Date.now() - entry.timestamp) / 1000;
    return age > entry.ttl;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
