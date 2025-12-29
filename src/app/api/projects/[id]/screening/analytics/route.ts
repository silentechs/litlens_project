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
  getScreeningAnalytics,
  getPRISMAFlowData,
} from "@/lib/services/screening-analytics";
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
    const phase = searchParams.get("phase") as "TITLE_ABSTRACT" | "FULL_TEXT" | undefined;
    const include = includeParam 
      ? includeParam.split(",") 
      : ["kappa", "agreement", "conflicts", "performance", "velocity", "stats"];

    // Use the comprehensive analytics service
    const analytics = await getScreeningAnalytics({
      projectId,
      phase,
      include,
    });

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
    const { format } = bodySchema.parse(body);

    // Gather all analytics
    const analytics = await getScreeningAnalytics({
      projectId,
      include: ["all"],
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      projectId,
      ...analytics,
    };

    if (format === "csv") {
      // Convert to CSV format
      const csvRows: string[] = [];
      
      // Add Kappa score
      csvRows.push("=== Inter-Rater Reliability ===");
      if (analytics.kappa) {
        csvRows.push(`Cohen's Kappa,${analytics.kappa.score || "N/A"}`);
        csvRows.push(`Interpretation,${analytics.kappa.interpretation}`);
        csvRows.push(`Studies Analyzed,${analytics.kappa.studiesAnalyzed}`);
      }
      csvRows.push("");
      
      // Add reviewer performance
      if (analytics.performance && analytics.performance.length > 0) {
        csvRows.push("=== Reviewer Performance ===");
        csvRows.push("Name,Studies Reviewed,Avg Time (s),Avg Confidence,Consensus Agreement");
        analytics.performance.forEach((r: any) => {
          csvRows.push(
            `${r.name},${r.studiesReviewed},${r.avgTimePerStudy},${r.avgConfidence},${r.agreementWithConsensus || "N/A"}%`
          );
        });
        csvRows.push("");
      }
      
      // Add velocity
      if (analytics.velocity && analytics.velocity.length > 0) {
        csvRows.push("=== Screening Velocity ===");
        csvRows.push("Date,Studies Screened,Avg Time per Study (s)");
        analytics.velocity.forEach((v: any) => {
          csvRows.push(`${v.date},${v.studiesScreened},${v.avgTimePerStudy}`);
        });
      }

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

