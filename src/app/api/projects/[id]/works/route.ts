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
  created,
  paginated,
  buildPaginationArgs,
} from "@/lib/api";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const addWorkSchema = z.object({
  // Either provide an existing workId or work data to create
  workId: z.string().cuid().optional(),
  workData: z.object({
    title: z.string().min(1).max(1000),
    authors: z.array(z.object({
      name: z.string().min(1).max(200),
      orcid: z.string().optional(),
    })).default([]),
    abstract: z.string().max(10000).optional(),
    year: z.number().int().min(1800).max(2100).optional(),
    journal: z.string().max(500).optional(),
    doi: z.string().max(200).optional(),
    pmid: z.string().max(20).optional(),
    url: z.string().url().optional(),
    keywords: z.array(z.string().max(100)).max(50).optional(),
    source: z.enum(["openalex", "pubmed", "crossref", "internal", "import", "semantic"]).optional(),
  }).optional(),
  // Optional metadata for the project work
  priority: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["PENDING", "SCREENING", "CONFLICT", "INCLUDED", "EXCLUDED", "MAYBE"]).optional(),
  phase: z.enum(["TITLE_ABSTRACT", "FULL_TEXT", "FINAL"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "title", "year", "priority"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * GET /api/projects/[id]/works
 * List all works in a project with filtering and pagination
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Verify membership
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

    const searchParams = request.nextUrl.searchParams;
    const query = querySchema.parse({
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      status: searchParams.get("status") || undefined,
      phase: searchParams.get("phase") || undefined,
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || undefined,
    });

    const { page, limit, status, phase, search, sortBy, sortOrder } = query;

    // Build where clause
    const where: Record<string, unknown> = { projectId };
    if (status) where.status = status;
    if (phase) where.phase = phase;
    if (search) {
      where.work = {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { abstract: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    // Build orderBy
    const orderBy: Record<string, unknown> = {};
    if (sortBy === "title" || sortBy === "year") {
      orderBy.work = { [sortBy]: sortOrder };
    } else {
      orderBy[sortBy] = sortOrder;
    }

    const [projectWorks, total] = await Promise.all([
      db.projectWork.findMany({
        where,
        ...buildPaginationArgs(page, limit),
        orderBy,
        include: {
          work: true,
          _count: {
            select: {
              decisions: true,
            },
          },
        },
      }),
      db.projectWork.count({ where }),
    ]);

    return paginated(projectWorks, total, page, limit);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/projects/[id]/works
 * Add a work to a project
 * 
 * Can either:
 * - Reference an existing work by workId
 * - Create a new work from workData
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Verify membership with appropriate role
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

    // Only OWNER, LEAD, or REVIEWER can add works
    if (!["OWNER", "LEAD", "REVIEWER"].includes(membership.role)) {
      throw new ForbiddenError("You don't have permission to add works to this project");
    }

    const body = await request.json();
    const { workId, workData, priority, notes } = addWorkSchema.parse(body);

    if (!workId && !workData) {
      throw new ForbiddenError("Either workId or workData must be provided");
    }

    let finalWorkId = workId;

    // If workData provided, find or create the work
    if (workData) {
      // Try to find existing work by DOI or PMID
      let existingWork = null;

      if (workData.doi) {
        existingWork = await db.work.findFirst({
          where: { doi: workData.doi },
        });
      }

      if (!existingWork && workData.pmid) {
        existingWork = await db.work.findFirst({
          where: { pmid: workData.pmid },
        });
      }

      // Check for existing work by DOI or PMID if not found by title
      if (!existingWork && (workData.doi || workData.pmid)) {
        existingWork = await db.work.findFirst({
          where: {
            OR: [
              workData.doi ? { doi: workData.doi } : {},
              workData.pmid ? { pmid: workData.pmid } : {},
            ].filter(obj => Object.keys(obj).length > 0),
          },
        });
      }

      if (existingWork) {
        finalWorkId = existingWork.id;
      } else {
        // Create new work
        const newWork = await db.work.create({
          data: {
            title: workData.title,
            abstract: workData.abstract,
            year: workData.year,
            journal: workData.journal,
            doi: workData.doi,
            pmid: workData.pmid,
            url: workData.url,
            keywords: workData.keywords || [],
            source: workData.source || "internal",
            authors: {
              create: workData.authors.map((author, index) => ({
                name: author.name,
                orcid: author.orcid,
                position: index,
              })),
            },
          },
        });
        finalWorkId = newWork.id;
      }
    }

    if (!finalWorkId) {
      throw new ForbiddenError("Could not resolve work ID");
    }

    // Check if already in project
    const existingProjectWork = await db.projectWork.findFirst({
      where: {
        projectId,
        workId: finalWorkId,
      },
    });

    if (existingProjectWork) {
      throw new ConflictError("This work is already in the project");
    }

    // Get project's current screening phase
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { title: true },
    });

    // Create project work
    const projectWork = await db.projectWork.create({
      data: {
        projectId,
        workId: finalWorkId,
        phase: "TITLE_ABSTRACT",
        status: "PENDING",
        priorityScore: priority || 50,
      },
      include: {
        work: true,
      },
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "STUDY_IMPORTED",
        description: `Added "${projectWork.work.title}" to project`,
        metadata: {
          projectWorkId: projectWork.id,
          workId: finalWorkId,
        },
      },
    });

    return created(projectWork);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/projects/[id]/works
 * Bulk remove works from a project
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Verify membership with appropriate role
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
      throw new ForbiddenError("Only project owners and leads can remove works");
    }

    const body = await request.json();
    const { workIds } = z.object({
      workIds: z.array(z.string().cuid()).min(1),
    }).parse(body);

    // Delete project works
    const result = await db.projectWork.deleteMany({
      where: {
        projectId,
        workId: { in: workIds },
      },
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "SETTINGS_UPDATED",
        description: `Removed ${result.count} works from project`,
        metadata: { workIds, count: result.count },
      },
    });

    return success({ removed: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}

