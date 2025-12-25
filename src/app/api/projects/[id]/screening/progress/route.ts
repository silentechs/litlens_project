import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  NotFoundError,
  success,
} from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/screening/progress - Get screening progress stats
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get overall counts by status
    const statusCounts = await db.projectWork.groupBy({
      by: ["status"],
      where: { projectId },
      _count: true,
    });

    // Get counts by phase
    const phaseCounts = await db.projectWork.groupBy({
      by: ["phase"],
      where: { projectId },
      _count: true,
    });

    // Get conflict counts
    const conflictCounts = await db.conflict.groupBy({
      by: ["status"],
      where: { projectId },
      _count: true,
    });

    // Get user-specific progress (for current user)
    const userDecisions = await db.screeningDecisionRecord.groupBy({
      by: ["phase", "decision"],
      where: {
        reviewerId: session.user.id,
        projectWork: { projectId },
      },
      _count: true,
    });

    // Calculate totals
    const totalStudies = statusCounts.reduce((sum, s) => sum + s._count, 0);
    
    const statusMap: Record<string, number> = {};
    statusCounts.forEach(s => {
      statusMap[s.status] = s._count;
    });

    const phaseMap: Record<string, number> = {};
    phaseCounts.forEach(p => {
      phaseMap[p.phase] = p._count;
    });

    const conflictMap: Record<string, number> = {};
    conflictCounts.forEach(c => {
      conflictMap[c.status] = c._count;
    });

    // Calculate user's progress per phase
    const userProgress: Record<string, { total: number; included: number; excluded: number; maybe: number }> = {};
    userDecisions.forEach(d => {
      if (!userProgress[d.phase]) {
        userProgress[d.phase] = { total: 0, included: 0, excluded: 0, maybe: 0 };
      }
      userProgress[d.phase].total += d._count;
      if (d.decision === "INCLUDE") userProgress[d.phase].included = d._count;
      else if (d.decision === "EXCLUDE") userProgress[d.phase].excluded = d._count;
      else if (d.decision === "MAYBE") userProgress[d.phase].maybe = d._count;
    });

    // Calculate completion percentages
    const completed = (statusMap.INCLUDED || 0) + (statusMap.EXCLUDED || 0);
    const pending = statusMap.PENDING || 0;
    const screening = statusMap.SCREENING || 0;
    const conflicts = statusMap.CONFLICT || 0;

    return success({
      total: totalStudies,
      completed,
      pending,
      screening,
      conflicts,
      maybe: statusMap.MAYBE || 0,
      
      completionRate: totalStudies > 0 ? Math.round((completed / totalStudies) * 100) : 0,
      
      byStatus: {
        pending: statusMap.PENDING || 0,
        screening: statusMap.SCREENING || 0,
        included: statusMap.INCLUDED || 0,
        excluded: statusMap.EXCLUDED || 0,
        maybe: statusMap.MAYBE || 0,
        conflict: statusMap.CONFLICT || 0,
      },
      
      byPhase: {
        titleAbstract: phaseMap.TITLE_ABSTRACT || 0,
        fullText: phaseMap.FULL_TEXT || 0,
        final: phaseMap.FINAL || 0,
      },
      
      conflictsByStatus: {
        pending: conflictMap.PENDING || 0,
        resolved: conflictMap.RESOLVED || 0,
      },
      
      userProgress,
      
      // For PRISMA flow visualization
      flow: {
        identified: totalStudies,
        duplicatesRemoved: 0, // Would need import batch data
        screened: completed + screening + conflicts,
        assessedForEligibility: statusMap.INCLUDED || 0,
        includedInReview: statusMap.INCLUDED || 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

