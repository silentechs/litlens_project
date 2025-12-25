import { db } from "@/lib/db";
import { runHealthCheck, metrics, type HealthStatus } from "@/lib/monitoring";
import { cache } from "@/lib/cache";

// Health check functions
const healthChecks = {
  database: async () => {
    await db.$queryRaw`SELECT 1`;
    return true;
  },
  cache: async () => {
    // Test cache write/read
    const testKey = "__health_check__";
    await cache.set(testKey, "ok", { ttl: 10 });
    const value = await cache.get(testKey);
    await cache.delete(testKey);
    return value === "ok";
  },
};

// GET /api/health - Health check endpoint
export async function GET(request: Request) {
  const url = new URL(request.url);
  const detailed = url.searchParams.get("detailed") === "true";

  try {
    const health: HealthStatus = await runHealthCheck(healthChecks);

    // Add metrics if detailed
    if (detailed) {
      const metricsData = metrics.getMetrics();
      const cacheStats = cache.getStats();

      return Response.json({
        ...health,
        timestamp: health.timestamp.toISOString(),
        metrics: {
          requests: metricsData.counters,
          timings: metricsData.timings,
          cache: cacheStats,
        },
      });
    }

    // Simple health response
    const statusCode = health.status === "healthy" ? 200 : 503;

    return Response.json(
      {
        status: health.status,
        timestamp: health.timestamp.toISOString(),
        checks: health.checks,
        uptime: health.uptime,
      },
      { status: statusCode }
    );
  } catch (error) {
    return Response.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}

// HEAD /api/health - Simple health probe
export async function HEAD() {
  try {
    await db.$queryRaw`SELECT 1`;
    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 503 });
  }
}

