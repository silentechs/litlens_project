import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  success,
  paginated,
  buildPaginationArgs,
} from "@/lib/api";
import { paginationSchema } from "@/lib/validators";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const createRoundSchema = z.object({
  phase: z.enum(["TITLE_ABSTRACT", "FULL_TEXT"]),
  sampleSize: z.number().int().min(10).max(100).default(20),
  targetAgreement: z.number().min(0).max(1).default(0.8),
  sampleMethod: z.enum(["random", "manual"]).default("random"),
  manualStudyIds: z.array(z.string()).optional(),
});

// GET /api/projects/[id]/calibration/rounds - List calibration rounds
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

    // Parse pagination
    const pagination = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    // Get total count
    const total = await db.calibrationRound.count({ where: { projectId } });

    // Get rounds
    const rounds = await db.calibrationRound.findMany({
      where: { projectId },
      ...buildPaginationArgs(pagination.page, pagination.limit),
      orderBy: { createdAt: "desc" },
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

    const roundsWithStats = rounds.map((round) => ({
      id: round.id,
      phase: round.phase,
      sampleSize: round.sampleSize,
      targetAgreement: round.targetAgreement,
      status: round.status,
      kappaScore: round.kappaScore,
      percentAgreement: round.percentAgreement,
      reviewersParticipated: new Set(round.decisions.map((d) => d.reviewerId)).size,
      decisionsCount: round.decisions.length,
      startedAt: round.startedAt?.toISOString() || null,
      completedAt: round.completedAt?.toISOString() || null,
      createdAt: round.createdAt.toISOString(),
    }));

    return paginated(roundsWithStats, total, pagination.page, pagination.limit);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/calibration/rounds - Create calibration round
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;
    const body = await request.json();
    const data = createRoundSchema.parse(body);

    // Check project access - only leads can create calibration rounds
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

    if (!["OWNER", "LEAD"].includes(membership.role)) {
      throw new ForbiddenError("Only project leads can create calibration rounds");
    }

    // Get sample studies
    let sampleStudyIds: string[];

    if (data.sampleMethod === "manual" && data.manualStudyIds) {
      sampleStudyIds = data.manualStudyIds.slice(0, data.sampleSize);
    } else {
      // Random sampling
      const allStudies = await db.projectWork.findMany({
        where: {
          projectId,
          status: { in: ["PENDING", "SCREENING"] },
        },
        select: { id: true },
        take: data.sampleSize * 3, // Get more to shuffle from
      });

      // Shuffle and take sampleSize
      const shuffled = allStudies.sort(() => Math.random() - 0.5);
      sampleStudyIds = shuffled.slice(0, data.sampleSize).map((s) => s.id);
    }

    if (sampleStudyIds.length === 0) {
      throw new Error("No studies available for calibration");
    }

    // Create calibration round
    const round = await db.calibrationRound.create({
      data: {
        projectId,
        phase: data.phase,
        sampleSize: sampleStudyIds.length,
        targetAgreement: data.targetAgreement,
        status: "PENDING",
      },
    });

    // Store sample study IDs (we'll use them for screening)
    // Note: The CalibrationDecision will be created when reviewers screen
    
    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "PROJECT_UPDATED",
        description: `Created calibration round for ${data.phase} phase`,
        metadata: {
          roundId: round.id,
          sampleSize: sampleStudyIds.length,
          targetKappa: data.targetAgreement,
        },
      },
    });

    return success({
      id: round.id,
      phase: round.phase,
      sampleSize: round.sampleSize,
      targetAgreement: round.targetAgreement,
      status: round.status,
      sampleStudyIds, // Return for UI to navigate to screening
      createdAt: round.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

