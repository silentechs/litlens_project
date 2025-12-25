import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  success,
} from "@/lib/api";
import {
  getScreeningOverview,
  getReviewerStats,
  getScreeningTimeline,
  getAIPerformance,
  getPRISMAFlow,
  getInterRaterReliability,
} from "@/lib/services/screening-analytics";
import { getConflictStats } from "@/lib/services/conflict-resolution";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/screening/analytics - Get screening analytics
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Check project access
    const membership = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError("Project");
    }

    // Determine which analytics to return
    const includeParam = searchParams.get("include");
    const include = includeParam 
      ? includeParam.split(",") 
      : ["overview", "reviewers", "timeline", "ai", "conflicts", "irr"];

    const analytics: Record<string, unknown> = {};

    // Fetch requested analytics in parallel
    const promises: Promise<void>[] = [];

    if (include.includes("overview")) {
      promises.push(
        getScreeningOverview(projectId).then((data) => {
          analytics.overview = data;
        })
      );
    }

    if (include.includes("reviewers")) {
      promises.push(
        getReviewerStats(projectId).then((data) => {
          analytics.reviewers = data;
        })
      );
    }

    if (include.includes("timeline")) {
      const days = parseInt(searchParams.get("days") || "30", 10);
      promises.push(
        getScreeningTimeline(projectId, days).then((data) => {
          analytics.timeline = data;
        })
      );
    }

    if (include.includes("ai")) {
      promises.push(
        getAIPerformance(projectId).then((data) => {
          analytics.aiPerformance = data;
        })
      );
    }

    if (include.includes("conflicts")) {
      promises.push(
        getConflictStats(projectId).then((data) => {
          analytics.conflicts = data;
        })
      );
    }

    if (include.includes("irr")) {
      const phase = searchParams.get("phase") as "TITLE_ABSTRACT" | "FULL_TEXT" | null;
      promises.push(
        getInterRaterReliability(projectId, phase || "TITLE_ABSTRACT").then((data) => {
          analytics.interRaterReliability = data;
        })
      );
    }

    if (include.includes("prisma")) {
      promises.push(
        getPRISMAFlow(projectId).then((data) => {
          analytics.prismaFlow = data;
        })
      );
    }

    await Promise.all(promises);

    return success(analytics);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/screening/analytics/export - Export analytics
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Check project access
    const membership = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError("Project");
    }

    // Parse export options
    const bodySchema = z.object({
      format: z.enum(["json", "csv"]).default("json"),
      include: z.array(z.string()).optional(),
    });

    const body = await request.json().catch(() => ({}));
    const { format, include } = bodySchema.parse(body);

    // Gather all analytics
    const [overview, reviewers, timeline, aiPerformance, conflicts, prismaFlow] = await Promise.all([
      getScreeningOverview(projectId),
      getReviewerStats(projectId),
      getScreeningTimeline(projectId, 90), // Last 90 days for export
      getAIPerformance(projectId),
      getConflictStats(projectId),
      getPRISMAFlow(projectId),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      projectId,
      overview,
      reviewers,
      timeline,
      aiPerformance,
      conflicts,
      prismaFlow,
    };

    if (format === "csv") {
      // Convert to CSV format
      const csvRows: string[] = [];
      
      // Add overview summary
      csvRows.push("=== Screening Overview ===");
      csvRows.push(`Total Studies,${overview.project.totalStudies}`);
      csvRows.push(`Completed,${overview.overall.completedStudies}`);
      csvRows.push(`Remaining,${overview.overall.remainingStudies}`);
      csvRows.push(`Progress,${overview.overall.percentComplete.toFixed(1)}%`);
      csvRows.push("");
      
      // Add reviewer stats
      csvRows.push("=== Reviewer Statistics ===");
      csvRows.push("User,Decisions,Avg Time (ms),Agreement Rate,Include Rate,Exclude Rate");
      reviewers.forEach((r) => {
        csvRows.push(
          `${r.userName || "Unknown"},${r.decisionsCount},${r.avgTimePerDecision?.toFixed(0) || "N/A"},${r.agreementRate?.toFixed(1) || "N/A"}%,${r.includedRate.toFixed(1)}%,${r.excludedRate.toFixed(1)}%`
        );
      });
      csvRows.push("");
      
      // Add timeline
      csvRows.push("=== Daily Timeline ===");
      csvRows.push("Date,Screened,Included,Excluded,Maybe,Cumulative");
      timeline.forEach((t) => {
        csvRows.push(`${t.date},${t.screened},${t.included},${t.excluded},${t.maybe},${t.cumulative}`);
      });

      return new Response(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="screening-analytics-${projectId}.csv"`,
        },
      });
    }

    return success(exportData);
  } catch (error) {
    return handleApiError(error);
  }
}

