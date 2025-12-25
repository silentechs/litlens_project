import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { metrics, errorTracker } from "@/lib/monitoring";
import { cache } from "@/lib/cache";
import { handleApiError, UnauthorizedError, ForbiddenError, success } from "@/lib/api";
import { db } from "@/lib/db";

// GET /api/metrics - Get application metrics (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      throw new ForbiddenError("Admin access required");
    }

    const searchParams = request.nextUrl.searchParams;
    const includeErrors = searchParams.get("errors") === "true";
    const includeCache = searchParams.get("cache") === "true";

    const metricsData = metrics.getMetrics();

    const response: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      counters: metricsData.counters,
      gauges: metricsData.gauges,
      timings: metricsData.timings,
    };

    if (includeCache) {
      response.cache = cache.getStats();
    }

    if (includeErrors) {
      response.recentErrors = errorTracker.getRecent(20).map((e) => ({
        message: e.message,
        context: e.context,
        timestamp: e.timestamp.toISOString(),
      }));
    }

    return success(response);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/metrics - Reset metrics (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      throw new ForbiddenError("Admin access required");
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "reset_metrics":
        metrics.reset();
        return success({ message: "Metrics reset" });
      case "clear_errors":
        errorTracker.clear();
        return success({ message: "Errors cleared" });
      case "clear_cache":
        await cache.clear();
        return success({ message: "Cache cleared" });
      default:
        return success({ message: "Unknown action" });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

