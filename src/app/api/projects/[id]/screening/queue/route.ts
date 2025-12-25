import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  NotFoundError,
  paginated,
  success,
  buildPaginationArgs,
  buildOrderBy,
} from "@/lib/api";
import { screeningQueueFiltersSchema, paginationSchema } from "@/lib/validators";
import { 
  getScreeningQueue, 
  getQueueStats, 
  updatePriorityScores,
  type QueueStrategy 
} from "@/lib/services/screening-queue";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/screening/queue - Get screening queue
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

    // Check if requesting smart queue or standard paginated list
    const useSmartQueue = searchParams.get("smart") === "true";
    const strategy = (searchParams.get("strategy") || "balanced") as QueueStrategy;

    if (useSmartQueue) {
      // Use smart queue service
      const queue = await getScreeningQueue({
        userId: session.user.id,
        projectId,
        phase: (searchParams.get("phase") as "TITLE_ABSTRACT" | "FULL_TEXT") || "TITLE_ABSTRACT",
        limit: parseInt(searchParams.get("limit") || "20", 10),
        strategy,
      });

      const stats = await getQueueStats(
        projectId,
        (searchParams.get("phase") as "TITLE_ABSTRACT" | "FULL_TEXT") || "TITLE_ABSTRACT"
      );

      return success({
        queue,
        stats,
        strategy,
      });
    }

    // Standard paginated queue
    const pagination = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      sortBy: searchParams.get("sortBy"),
      sortOrder: searchParams.get("sortOrder"),
    });

    const filters = screeningQueueFiltersSchema.parse({
      phase: searchParams.get("phase") || "TITLE_ABSTRACT",
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      hasAiSuggestion: searchParams.get("hasAiSuggestion") === "true" ? true : undefined,
      aiSuggestion: searchParams.get("aiSuggestion") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || undefined,
    });

    // Build where clause
    const where: Record<string, unknown> = {
      projectId,
      phase: filters.phase,
    };

    // Only show pending items in queue by default
    if (filters.status) {
      where.status = filters.status;
    } else {
      where.status = { in: ["PENDING", "SCREENING"] };
    }

    // AI suggestion filter
    if (filters.hasAiSuggestion) {
      where.aiSuggestion = { not: null };
    }

    if (filters.aiSuggestion) {
      where.aiSuggestion = filters.aiSuggestion;
    }

    // Search filter
    if (filters.search) {
      where.work = {
        OR: [
          { title: { contains: filters.search, mode: "insensitive" } },
          { abstract: { contains: filters.search, mode: "insensitive" } },
        ],
      };
    }

    // Get total count
    const total = await db.projectWork.count({ where });

    // Build order by - support AI confidence sorting
    let orderBy: Record<string, unknown>[];
    if (pagination.sortBy === "aiConfidence") {
      orderBy = [
        { aiConfidence: { sort: pagination.sortOrder || "desc", nulls: "last" } },
        { priorityScore: "desc" },
      ];
    } else if (pagination.sortBy === "priorityScore") {
      orderBy = [{ priorityScore: pagination.sortOrder || "desc" }];
    } else {
      orderBy = [buildOrderBy(pagination.sortBy, pagination.sortOrder, "createdAt")];
    }

    // Get queue items
    const items = await db.projectWork.findMany({
      where,
      ...buildPaginationArgs(pagination.page, pagination.limit),
      orderBy,
      include: {
        work: {
          select: {
            id: true,
            title: true,
            abstract: true,
            authors: true,
            year: true,
            journal: true,
            doi: true,
            keywords: true,
          },
        },
        decisions: {
          where: {
            reviewerId: session.user.id,
            phase: filters.phase || "TITLE_ABSTRACT",
          },
          take: 1,
        },
      },
    });

    // Transform response
    const queueItems = items.map((item) => {
      const authors = (item.work.authors as Array<{ name: string }>) || [];
      const userDecision = item.decisions[0];

      return {
        id: item.id,
        workId: item.workId,
        status: item.status,
        phase: item.phase,
        title: item.work.title,
        authors,
        abstract: item.work.abstract,
        journal: item.work.journal,
        year: item.work.year,
        doi: item.work.doi,
        keywords: item.work.keywords,
        aiSuggestion: item.aiSuggestion,
        aiConfidence: item.aiConfidence,
        aiReasoning: item.aiReasoning,
        priorityScore: item.priorityScore,
        userDecision: userDecision?.decision || null,
        importSource: item.importSource,
        createdAt: item.createdAt.toISOString(),
      };
    });

    return paginated(queueItems, total, pagination.page, pagination.limit);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/projects/[id]/screening/queue - Update queue priorities
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Check project access (only leads can update priorities)
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
      throw new UnauthorizedError();
    }

    // Parse options
    const bodySchema = z.object({
      boostByYear: z.boolean().optional(),
      boostByJournal: z.array(z.string()).optional(),
      boostByKeywords: z.array(z.string()).optional(),
    });

    const body = await request.json().catch(() => ({}));
    const options = bodySchema.parse(body);

    const updated = await updatePriorityScores(projectId, options);

    return success({
      message: `Updated priority scores for ${updated} studies`,
      updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

