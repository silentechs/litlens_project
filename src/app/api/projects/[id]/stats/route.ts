import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  success,
} from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/stats - Get project statistics
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id } = await params;

    // Check project exists and user has access
    const project = await db.project.findUnique({
      where: { id },
      include: {
        members: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!project) {
      throw new NotFoundError("Project");
    }

    if (project.members.length === 0 && !project.isPublic) {
      throw new ForbiddenError();
    }

    // Get screening stats
    const [
      totalStudies,
      byStatus,
      byPhase,
      conflictStats,
      extractionStats,
      qualityStats,
    ] = await Promise.all([
      // Total studies
      db.projectWork.count({ where: { projectId: id } }),

      // By status
      db.projectWork.groupBy({
        by: ["status"],
        where: { projectId: id },
        _count: true,
      }),

      // By phase
      db.projectWork.groupBy({
        by: ["phase"],
        where: { projectId: id },
        _count: true,
      }),

      // Conflicts
      db.conflict.groupBy({
        by: ["status"],
        where: { projectId: id },
        _count: true,
      }),

      // Extraction
      db.extractionData.groupBy({
        by: ["status"],
        where: { projectId: id },
        _count: true,
      }),

      // Quality assessment
      db.qualityAssessment.groupBy({
        by: ["status"],
        where: { projectId: id },
        _count: true,
      }),
    ]);

    // Transform stats
    const statusCounts = Object.fromEntries(
      byStatus.map((s) => [s.status, s._count])
    );

    const phaseCounts = Object.fromEntries(
      byPhase.map((p) => [p.phase, p._count])
    );

    const conflictCounts = Object.fromEntries(
      conflictStats.map((c) => [c.status, c._count])
    );

    const extractionCounts = Object.fromEntries(
      extractionStats.map((e) => [e.status, e._count])
    );

    const qualityCounts = Object.fromEntries(
      qualityStats.map((q) => [q.status, q._count])
    );

    // Calculate progress percentages
    const screeningCompleted = (statusCounts.INCLUDED || 0) + (statusCounts.EXCLUDED || 0);
    const screeningTotal = totalStudies;
    
    const stats = {
      totalStudies,
      pendingScreening: statusCounts.PENDING || 0,
      included: statusCounts.INCLUDED || 0,
      excluded: statusCounts.EXCLUDED || 0,
      conflicts: conflictCounts.PENDING || 0,
      extractionCompleted: extractionCounts.COMPLETED || 0,
      qualityAssessed: qualityCounts.COMPLETED || 0,
      progress: {
        screening: {
          total: screeningTotal,
          completed: screeningCompleted,
          percentage: screeningTotal > 0 
            ? Math.round((screeningCompleted / screeningTotal) * 100) 
            : 0,
        },
        fullText: {
          total: phaseCounts.FULL_TEXT || 0,
          completed: 0, // Would need more complex query
          percentage: 0,
        },
        extraction: {
          total: statusCounts.INCLUDED || 0,
          completed: extractionCounts.COMPLETED || 0,
          percentage: (statusCounts.INCLUDED || 0) > 0
            ? Math.round(((extractionCounts.COMPLETED || 0) / (statusCounts.INCLUDED || 1)) * 100)
            : 0,
        },
        quality: {
          total: statusCounts.INCLUDED || 0,
          completed: qualityCounts.COMPLETED || 0,
          percentage: (statusCounts.INCLUDED || 0) > 0
            ? Math.round(((qualityCounts.COMPLETED || 0) / (statusCounts.INCLUDED || 1)) * 100)
            : 0,
        },
      },
    };

    return success(stats);
  } catch (error) {
    return handleApiError(error);
  }
}

