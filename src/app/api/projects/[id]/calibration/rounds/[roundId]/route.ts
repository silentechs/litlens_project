import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  success,
} from "@/lib/api";
import { calculateCohensKappa, interpretKappa } from "@/lib/services/screening-analytics";
import { ScreeningDecision } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string; roundId: string }>;
}

// GET /api/projects/[id]/calibration/rounds/[roundId] - Get calibration round details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, roundId } = await params;

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

    // Get round
    const round = await db.calibrationRound.findFirst({
      where: {
        id: roundId,
        projectId,
      },
      include: {
        decisions: {
          include: {
            reviewer: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!round) {
      throw new NotFoundError("Calibration round");
    }

    // Get unique projectWorkIds to fetch study details
    const projectWorkIds = [...new Set(round.decisions.map(d => d.projectWorkId))];

    // Fetch study details separately
    const projectWorks = await db.projectWork.findMany({
      where: { id: { in: projectWorkIds } },
      include: {
        work: {
          select: {
            title: true,
            authors: true,
            year: true,
            abstract: true,
          },
        },
      },
    });

    const workMap = new Map(projectWorks.map(pw => [pw.id, pw.work]));

    // Group decisions by study
    const studyMap: Record<string, any> = {};
    for (const decision of round.decisions) {
      const studyId = decision.projectWorkId;
      const work = workMap.get(studyId);
      if (!studyMap[studyId]) {
        studyMap[studyId] = {
          projectWorkId: studyId,
          title: work?.title || "Unknown",
          authors: work?.authors || [],
          year: work?.year || null,
          abstract: work?.abstract || null,
          decisions: [],
        };
      }
      studyMap[studyId].decisions.push({
        reviewerId: decision.reviewerId,
        reviewerName: decision.reviewer.name,
        decision: decision.decision,
        reasoning: decision.reasoning,
        timeSpentMs: decision.timeSpentMs,
      });
    }

    const studies = Object.values(studyMap);

    return success({
      id: round.id,
      phase: round.phase,
      sampleSize: round.sampleSize,
      targetAgreement: round.targetAgreement,
      status: round.status,
      kappaScore: round.kappaScore,
      percentAgreement: round.percentAgreement,
      startedAt: round.startedAt?.toISOString() || null,
      completedAt: round.completedAt?.toISOString() || null,
      createdAt: round.createdAt.toISOString(),
      studies,
      reviewersParticipated: new Set(round.decisions.map((d) => d.reviewerId)).size,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/calibration/rounds/[roundId]/complete - Complete and calculate Kappa
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, roundId } = await params;

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

    // Get round with decisions
    const round = await db.calibrationRound.findFirst({
      where: {
        id: roundId,
        projectId,
      },
      include: {
        decisions: true,
      },
    });

    if (!round) {
      throw new NotFoundError("Calibration round");
    }

    // Group decisions by study
    const studyDecisions: Record<string, any[]> = {};
    for (const decision of round.decisions) {
      if (!studyDecisions[decision.projectWorkId]) {
        studyDecisions[decision.projectWorkId] = [];
      }
      studyDecisions[decision.projectWorkId].push(decision);
    }

    // Calculate Kappa for studies with exactly 2 decisions
    const pairs: Array<{ reviewer1: ScreeningDecision; reviewer2: ScreeningDecision }> = [];
    let totalAgreements = 0;
    let totalComparisons = 0;

    for (const [_, decisions] of Object.entries(studyDecisions)) {
      if (decisions.length === 2) {
        pairs.push({
          reviewer1: decisions[0].decision as ScreeningDecision,
          reviewer2: decisions[1].decision as ScreeningDecision,
        });

        totalComparisons++;
        if (decisions[0].decision === decisions[1].decision) {
          totalAgreements++;
        }
      }
    }

    if (pairs.length === 0) {
      throw new Error("Need at least one study with two reviews to calculate Kappa");
    }

    const kappa = calculateCohensKappa(pairs);
    const percentAgreement = (totalAgreements / totalComparisons) * 100;
    const interpretation = interpretKappa(kappa);

    // Update round
    const updatedRound = await db.calibrationRound.update({
      where: { id: roundId },
      data: {
        status: "PASSED",
        kappaScore: kappa,
        percentAgreement,
        completedAt: new Date(),
      },
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "PROJECT_UPDATED",
        description: `Completed calibration round with Kappa=${kappa.toFixed(3)}`,
        metadata: {
          roundId,
          kappaScore: kappa,
          interpretation: interpretation.level,
          studiesAnalyzed: pairs.length,
        },
      },
    });

    return success({
      id: updatedRound.id,
      status: updatedRound.status,
      kappaScore: kappa,
      percentAgreement,
      interpretation,
      studiesAnalyzed: pairs.length,
      message:
        kappa >= round.targetAgreement
          ? "Calibration successful! Agreement meets target threshold."
          : "Calibration complete, but agreement below target. Consider team discussion.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

