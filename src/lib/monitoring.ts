/**
 * Monitoring & Error Tracking
 * Application monitoring, metrics, and error handling
 */

// ============== TYPES ==============

export interface ErrorContext {
  userId?: string;
  projectId?: string;
  organizationId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  extra?: Record<string, unknown>;
}

export interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

export interface TimingResult {
  duration: number;
  startTime: Date;
  endTime: Date;
}

// ============== ERROR TRACKING ==============

class ErrorTracker {
  private errors: Array<{
    error: Error;
    context: ErrorContext;
    timestamp: Date;
  }> = [];

  private readonly maxErrors = 1000;

  /**
   * Capture an error
   */
  capture(error: Error, context: ErrorContext = {}): void {
    // Add to in-memory storage (for development/debugging)
    this.errors.push({
      error,
      context,
      timestamp: new Date(),
    });

    // Trim if too many
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("[Error]", {
        message: error.message,
        stack: error.stack,
        context,
      });
    }

    // In production, you would send to a service like Sentry
    // Example: Sentry.captureException(error, { extra: context });
  }

  /**
   * Get recent errors
   */
  getRecent(limit = 50): Array<{
    message: string;
    stack?: string;
    context: ErrorContext;
    timestamp: Date;
  }> {
    return this.errors.slice(-limit).map((e) => ({
      message: e.error.message,
      stack: e.error.stack,
      context: e.context,
      timestamp: e.timestamp,
    }));
  }

  /**
   * Clear errors
   */
  clear(): void {
    this.errors = [];
  }
}

export const errorTracker = new ErrorTracker();

// ============== METRICS ==============

class MetricsCollector {
  private metrics: Map<string, MetricData[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private timings: Map<string, number[]> = new Map();

  private readonly maxDataPoints = 1000;

  /**
   * Increment a counter
   */
  increment(name: string, value = 1, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  /**
   * Set a gauge value
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    this.gauges.set(key, value);
  }

  /**
   * Record a timing
   */
  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    const timings = this.timings.get(key) || [];
    timings.push(durationMs);

    // Keep only recent timings
    if (timings.length > this.maxDataPoints) {
      timings.shift();
    }

    this.timings.set(key, timings);
  }

  /**
   * Get all metrics
   */
  getMetrics(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    timings: Record<string, { avg: number; min: number; max: number; p95: number; count: number }>;
  } {
    const timingStats: Record<string, { avg: number; min: number; max: number; p95: number; count: number }> = {};

    for (const [key, values] of this.timings.entries()) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      const p95Index = Math.floor(values.length * 0.95);

      timingStats[key] = {
        avg: sum / values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[p95Index] || sorted[sorted.length - 1],
        count: values.length,
      };
    }

    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      timings: timingStats,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.timings.clear();
  }

  private buildKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }

    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(",");

    return `${name}{${tagStr}}`;
  }
}

export const metrics = new MetricsCollector();

// ============== TIMING UTILITIES ==============

/**
 * Time a function execution
 */
export async function timeAsync<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const duration = Date.now() - start;
    metrics.timing(name, duration, tags);
  }
}

/**
 * Time a sync function
 */
export function timeSync<T>(
  name: string,
  fn: () => T,
  tags?: Record<string, string>
): T {
  const start = Date.now();
  try {
    return fn();
  } finally {
    const duration = Date.now() - start;
    metrics.timing(name, duration, tags);
  }
}

/**
 * Create a timer for manual timing
 */
export function createTimer(): {
  stop: () => TimingResult;
} {
  const startTime = new Date();

  return {
    stop: () => {
      const endTime = new Date();
      return {
        duration: endTime.getTime() - startTime.getTime(),
        startTime,
        endTime,
      };
    },
  };
}

// ============== REQUEST TRACKING ==============

let requestCounter = 0;

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  requestCounter++;
  return `req_${Date.now()}_${requestCounter.toString(36)}`;
}

/**
 * Track API request metrics
 */
export function trackApiRequest(data: {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  userId?: string;
}): void {
  // Increment request counter
  metrics.increment("api.requests.total", 1, {
    method: data.method,
    path: normalizePathForMetrics(data.path),
  });

  // Track by status code
  metrics.increment("api.requests.by_status", 1, {
    status: String(data.statusCode),
  });

  // Track duration
  metrics.timing("api.request.duration", data.duration, {
    method: data.method,
    path: normalizePathForMetrics(data.path),
  });

  // Track errors
  if (data.statusCode >= 400) {
    metrics.increment("api.errors.total", 1, {
      status: String(data.statusCode),
    });
  }
}

/**
 * Normalize path for metrics (remove IDs)
 */
function normalizePathForMetrics(path: string): string {
  return path
    .replace(/\/[a-z0-9]{24,}/gi, "/:id") // CUID
    .replace(/\/[0-9a-f-]{36}/gi, "/:uuid") // UUID
    .replace(/\/\d+/g, "/:num"); // Numeric IDs
}

// ============== HEALTH CHECK ==============

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  checks: Record<string, {
    status: "pass" | "fail";
    latency?: number;
    message?: string;
  }>;
  version?: string;
  uptime?: number;
}

const startTime = Date.now();

/**
 * Run health checks
 */
export async function runHealthCheck(
  checks: Record<string, () => Promise<boolean>>
): Promise<HealthStatus> {
  const results: HealthStatus["checks"] = {};
  let hasFailure = false;

  for (const [name, check] of Object.entries(checks)) {
    const start = Date.now();
    try {
      const passed = await Promise.race([
        check(),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 5000)
        ),
      ]);

      results[name] = {
        status: passed ? "pass" : "fail",
        latency: Date.now() - start,
      };

      if (!passed) hasFailure = true;
    } catch (error) {
      results[name] = {
        status: "fail",
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : "Unknown error",
      };
      hasFailure = true;
    }
  }

  return {
    status: hasFailure ? "unhealthy" : "healthy",
    timestamp: new Date(),
    checks: results,
    uptime: Date.now() - startTime,
  };
}

// ============== LOGGING ==============

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

class Logger {
  private minLevel: LogLevel = "info";
  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const output = {
      level: entry.level,
      message: entry.message,
      timestamp: entry.timestamp.toISOString(),
      ...entry.context,
    };

    switch (entry.level) {
      case "debug":
        console.debug(JSON.stringify(output));
        break;
      case "info":
        console.info(JSON.stringify(output));
        break;
      case "warn":
        console.warn(JSON.stringify(output));
        break;
      case "error":
        console.error(JSON.stringify(output));
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log({ level: "debug", message, timestamp: new Date(), context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log({ level: "info", message, timestamp: new Date(), context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log({ level: "warn", message, timestamp: new Date(), context });
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log({ level: "error", message, timestamp: new Date(), context });
  }
}

export const logger = new Logger();

// Set log level based on environment
if (process.env.NODE_ENV === "development") {
  logger.setLevel("debug");
}

