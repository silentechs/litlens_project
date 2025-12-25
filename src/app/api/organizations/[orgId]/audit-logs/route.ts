import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  success,
  paginated,
} from "@/lib/api";
import {
  getAuditLogs,
  getAuditStats,
  searchAuditLogs,
  exportAuditLogs,
} from "@/lib/services/audit-log";
import { checkOrganizationPermission } from "@/lib/services/organizations";

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

// GET /api/organizations/[orgId]/audit-logs - Get audit logs
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { orgId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Only owners and admins can view audit logs
    const hasPermission = await checkOrganizationPermission(
      orgId,
      session.user.id,
      ["OWNER", "ADMIN"]
    );

    if (!hasPermission) {
      throw new ForbiddenError("Only owners and admins can view audit logs");
    }

    // Handle different query types
    const action = searchParams.get("action");

    // Stats view
    if (action === "stats") {
      const days = parseInt(searchParams.get("days") || "30");
      const stats = await getAuditStats(orgId, days);
      return success(stats);
    }

    // Export
    if (action === "export") {
      const startDate = new Date(searchParams.get("startDate") || Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date(searchParams.get("endDate") || Date.now());
      const format = (searchParams.get("format") || "json") as "json" | "csv";

      const exported = await exportAuditLogs(orgId, {
        startDate,
        endDate,
        format,
      });

      const contentType = format === "csv" ? "text/csv" : "application/json";
      return new Response(exported, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="audit-logs.${format}"`,
        },
      });
    }

    // Search
    const searchTerm = searchParams.get("search");
    if (searchTerm) {
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "50");

      const result = await searchAuditLogs(orgId, searchTerm, { page, limit });

      return paginated(
        result.logs.map((l) => ({
          ...l,
          createdAt: l.createdAt.toISOString(),
        })),
        result.total,
        page,
        limit
      );
    }

    // Regular list
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const userId = searchParams.get("userId") || undefined;
    const logAction = searchParams.get("logAction") || undefined;
    const resource = searchParams.get("resource") || undefined;
    const resourceId = searchParams.get("resourceId") || undefined;
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;

    const result = await getAuditLogs(orgId, {
      page,
      limit,
      userId,
      action: logAction as import("@/lib/services/audit-log").AuditAction | undefined,
      resource: resource as import("@/lib/services/audit-log").AuditResource | undefined,
      resourceId,
      startDate,
      endDate,
    });

    return paginated(
      result.logs.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      })),
      result.total,
      page,
      limit
    );
  } catch (error) {
    return handleApiError(error);
  }
}

