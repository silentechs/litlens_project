/**
 * Rate Limiting
 * Sliding window rate limiter with in-memory storage
 */

// ============== TYPES ==============

export interface RateLimitConfig {
  windowMs: number; // Window size in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until retry
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ============== RATE LIMITER ==============

class RateLimiter {
  private storage: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed
   */
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const fullKey = `${config.keyPrefix || "rl"}:${key}`;

    let entry = this.storage.get(fullKey);

    // If no entry or expired, create new window
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
      };
    }

    const allowed = entry.count < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - entry.count - (allowed ? 1 : 0));
    const resetAt = new Date(entry.resetAt);

    if (allowed) {
      entry.count++;
      this.storage.set(fullKey, entry);
    }

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  /**
   * Increment counter (for tracking after request)
   */
  increment(key: string, config: RateLimitConfig): void {
    const now = Date.now();
    const fullKey = `${config.keyPrefix || "rl"}:${key}`;

    let entry = this.storage.get(fullKey);

    if (!entry || entry.resetAt < now) {
      entry = {
        count: 1,
        resetAt: now + config.windowMs,
      };
    } else {
      entry.count++;
    }

    this.storage.set(fullKey, entry);
  }

  /**
   * Reset a key
   */
  reset(key: string, prefix = "rl"): void {
    this.storage.delete(`${prefix}:${key}`);
  }

  /**
   * Get current usage
   */
  getUsage(key: string, config: RateLimitConfig): { count: number; remaining: number } {
    const fullKey = `${config.keyPrefix || "rl"}:${key}`;
    const entry = this.storage.get(fullKey);
    const now = Date.now();

    if (!entry || entry.resetAt < now) {
      return { count: 0, remaining: config.maxRequests };
    }

    return {
      count: entry.count,
      remaining: Math.max(0, config.maxRequests - entry.count),
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.storage.entries()) {
      if (entry.resetAt < now) {
        this.storage.delete(key);
      }
    }
  }

  /**
   * Destroy the limiter (clear interval)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.storage.clear();
  }
}

// ============== SINGLETON INSTANCE ==============

export const rateLimiter = new RateLimiter();

// ============== PRESET CONFIGURATIONS ==============

export const rateLimitPresets = {
  // Standard API rate limiting
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyPrefix: "api",
  } as RateLimitConfig,

  // Strict limiting for auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    keyPrefix: "auth",
  } as RateLimitConfig,

  // Import/heavy operations
  import: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyPrefix: "import",
  } as RateLimitConfig,

  // AI operations
  ai: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    keyPrefix: "ai",
  } as RateLimitConfig,

  // Export/download
  export: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    keyPrefix: "export",
  } as RateLimitConfig,

  // Webhook deliveries
  webhook: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
    keyPrefix: "webhook",
  } as RateLimitConfig,
};

// ============== MIDDLEWARE HELPER ==============

import { NextRequest, NextResponse } from "next/server";

/**
 * Rate limit middleware helper
 */
export function withRateLimit(
  config: RateLimitConfig,
  keyExtractor: (req: NextRequest) => string
) {
  return async function middleware(request: NextRequest) {
    const key = keyExtractor(request);
    const result = rateLimiter.check(key, config);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests",
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfter),
            "X-RateLimit-Limit": String(config.maxRequests),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": result.resetAt.toISOString(),
          },
        }
      );
    }

    return null; // Continue to handler
  };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  config: RateLimitConfig
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(config.maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": result.resetAt.toISOString(),
  };
}

// ============== KEY EXTRACTORS ==============

/**
 * Extract rate limit key from request
 */
export function extractRateLimitKey(request: NextRequest): string {
  // Try to get user ID from session (would need auth check)
  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  return ip;
}

/**
 * Extract key combining IP and path
 */
export function extractPathKey(request: NextRequest): string {
  const ip = extractRateLimitKey(request);
  const path = request.nextUrl.pathname;
  return `${ip}:${path}`;
}

