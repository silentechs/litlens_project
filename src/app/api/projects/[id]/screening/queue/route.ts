import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  paginated,
  buildPaginationArgs,
  buildOrderBy,
} from "@/lib/api";
import { screeningQueueFiltersSchema, paginationSchema } from "@/lib/validators";

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

    // Parse filters
    const pagination = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      sortBy: searchParams.get("sortBy"),
      sortOrder: searchParams.get("sortOrder"),
    });

    const filters = screeningQueueFiltersSchema.parse({
      phase: searchParams.get("phase") || "TITLE_ABSTRACT",
      status: searchParams.get("status"),
      search: searchParams.get("search"),
      hasAiSuggestion: searchParams.get("hasAiSuggestion") === "true" ? true : undefined,
      aiSuggestion: searchParams.get("aiSuggestion"),
      sortBy: searchParams.get("sortBy"),
      sortOrder: searchParams.get("sortOrder"),
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

    // Get queue items
    const items = await db.projectWork.findMany({
      where,
      ...buildPaginationArgs(pagination.page, pagination.limit),
      orderBy: buildOrderBy(
        pagination.sortBy === "aiConfidence" ? undefined : pagination.sortBy,
        pagination.sortOrder,
        "createdAt"
      ),
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
          },
        },
        screeningDecisions: {
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
      const userDecision = item.screeningDecisions[0];

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
        aiSuggestion: null, // TODO: Add AI suggestions
        aiConfidence: null,
        aiReasoning: null,
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

