import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  NotFoundError,
  paginated,
  buildPaginationArgs,
} from "@/lib/api";
import { paginationSchema } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/conflicts - Get project conflicts
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

    // Filter by status
    const status = searchParams.get("status");
    const where: Record<string, unknown> = { projectId };
    if (status) {
      where.status = status;
    }

    // Get total count
    const total = await db.conflict.count({ where });

    // Get conflicts with related data
    const conflicts = await db.conflict.findMany({
      where,
      ...buildPaginationArgs(pagination.page, pagination.limit),
      orderBy: { createdAt: "desc" },
      include: {
        resolution: {
          include: {
            resolver: {
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

    // Get work details for each conflict
    const conflictsWithDetails = await Promise.all(
      conflicts.map(async (conflict) => {
        const projectWork = await db.projectWork.findUnique({
          where: { id: conflict.projectWorkId },
          include: {
            work: {
              select: {
                title: true,
                authors: true,
                year: true,
              },
            },
          },
        });

        // Get reviewer names for decisions
        const decisions = conflict.decisions as Array<{
          reviewerId: string;
          decision: string;
          reasoning: string | null;
        }>;

        const reviewerIds = decisions.map((d) => d.reviewerId);
        const reviewers = await db.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, name: true, image: true },
        });

        const reviewerMap = Object.fromEntries(
          reviewers.map((r) => [r.id, r])
        );

        return {
          id: conflict.id,
          projectId: conflict.projectId,
          projectWorkId: conflict.projectWorkId,
          phase: conflict.phase,
          status: conflict.status,
          decisions: decisions.map((d) => ({
            reviewerId: d.reviewerId,
            reviewerName: reviewerMap[d.reviewerId]?.name || null,
            reviewerImage: reviewerMap[d.reviewerId]?.image || null,
            decision: d.decision,
            reasoning: d.reasoning,
          })),
          createdAt: conflict.createdAt.toISOString(),
          resolvedAt: conflict.resolvedAt?.toISOString() || null,
          work: projectWork
            ? {
                title: projectWork.work.title,
                authors: projectWork.work.authors as Array<{ name: string }>,
                year: projectWork.work.year,
              }
            : null,
          resolution: conflict.resolution
            ? {
                id: conflict.resolution.id,
                finalDecision: conflict.resolution.finalDecision,
                reasoning: conflict.resolution.reasoning,
                resolver: conflict.resolution.resolver,
                createdAt: conflict.resolution.createdAt.toISOString(),
              }
            : null,
        };
      })
    );

    return paginated(conflictsWithDetails, total, pagination.page, pagination.limit);
  } catch (error) {
    return handleApiError(error);
  }
}

