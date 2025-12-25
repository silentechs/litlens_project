import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  success,
} from "@/lib/api";
import { resolveConflictSchema } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string; conflictId: string }>;
}

// POST /api/projects/[id]/conflicts/[conflictId]/resolve - Resolve a conflict
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, conflictId } = await params;
    const body = await request.json();
    const data = resolveConflictSchema.parse(body);

    // Check project membership - only leads can resolve
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
      throw new ForbiddenError("Only project leads can resolve conflicts");
    }

    // Get conflict
    const conflict = await db.conflict.findUnique({
      where: { id: conflictId },
      include: {
        resolution: true,
      },
    });

    if (!conflict || conflict.projectId !== projectId) {
      throw new NotFoundError("Conflict");
    }

    if (conflict.resolution) {
      throw new ConflictError("This conflict has already been resolved");
    }

    // Create resolution in transaction
    const result = await db.$transaction(async (tx) => {
      // Create resolution
      const resolution = await tx.conflictResolution.create({
        data: {
          conflictId,
          resolverId: session.user.id,
          finalDecision: data.finalDecision,
          reasoning: data.reasoning,
        },
        include: {
          resolver: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      // Update conflict status
      await tx.conflict.update({
        where: { id: conflictId },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
      });

      // Update projectWork status
      await tx.projectWork.update({
        where: { id: conflict.projectWorkId },
        data: {
          status: data.finalDecision === "INCLUDE"
            ? "INCLUDED"
            : data.finalDecision === "EXCLUDE"
              ? "EXCLUDED"
              : "MAYBE",
          finalDecision: data.finalDecision,
        },
      });

      return resolution;
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "CONFLICT_RESOLVED",
        description: `Resolved conflict with ${data.finalDecision} decision`,
        metadata: {
          conflictId,
          projectWorkId: conflict.projectWorkId,
          finalDecision: data.finalDecision,
        },
      },
    });

    return success({
      id: result.id,
      conflictId: result.conflictId,
      resolverId: result.resolverId,
      finalDecision: result.finalDecision,
      reasoning: result.reasoning,
      createdAt: result.createdAt.toISOString(),
      resolver: result.resolver,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

