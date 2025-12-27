import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  created,
  paginated,
  buildPaginationArgs,
  buildOrderBy,
  buildSearchFilter,
} from "@/lib/api";
import {
  createProjectSchema,
  projectFiltersSchema,
  paginationSchema
} from "@/lib/validators";

import { authenticateRequest } from "@/lib/middleware/auth-check";

// GET /api/projects - List projects
export async function GET(request: NextRequest) {
  try {
    const identity = await authenticateRequest(request);

    const searchParams = request.nextUrl.searchParams;

    // Parse query params
    const pagination = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      sortBy: searchParams.get("sortBy"),
      sortOrder: searchParams.get("sortOrder"),
    });

    const filters = projectFiltersSchema.parse({
      status: searchParams.get("status"),
      search: searchParams.get("search"),
      isArchived: searchParams.get("isArchived") === "true",
    });

    // Build where clause
    const where: Record<string, any> = {};

    if (identity.type === "session") {
      where.members = {
        some: {
          userId: identity.userId,
        },
      };
    } else if (identity.type === "api_key") {
      where.organizationId = identity.organizationId;
    }

    // Apply filters
    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    if (filters.isArchived !== undefined) {
      where.archivedAt = filters.isArchived ? { not: null } : null;
    }

    // Apply search
    if (filters.search) {
      const searchFilter = buildSearchFilter(filters.search, ["title", "description"]);
      if (searchFilter) {
        where.AND = [searchFilter];
      }
    }

    // Get total count
    const total = await db.project.count({ where });

    // Get projects
    const projects = await db.project.findMany({
      where,
      ...buildPaginationArgs(pagination.page, pagination.limit),
      orderBy: buildOrderBy(pagination.sortBy, pagination.sortOrder, "updatedAt"),
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          take: 5,
        },
        _count: {
          select: {
            projectWorks: true,
            members: true,
            conflicts: {
              where: { status: "PENDING" },
            },
          },
        },
      },
    });

    // Fetch progress stats for these projects
    const projectIds = projects.map((p) => p.id);
    const progressStats = await db.projectWork.groupBy({
      by: ['projectId', 'status'],
      where: {
        projectId: { in: projectIds }
      },
      _count: true
    });

    // Transform response
    const items = projects.map((project) => {
      // Calculate real progress
      const stats = progressStats.filter((s) => s.projectId === project.id);
      const totalWorks = project._count.projectWorks;

      const completedCount = stats.reduce((acc: number, curr) => {
        if (["INCLUDED", "EXCLUDED", "MAYBE"].includes(curr.status)) {
          return acc + (curr._count as number);
        }
        return acc;
      }, 0);

      const progress = totalWorks > 0
        ? Math.round((completedCount / totalWorks) * 100)
        : 0;

      return {
        id: project.id,
        title: project.title,
        description: project.description,
        slug: project.slug,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        _count: {
          projectWorks: totalWorks,
          members: project._count.members,
        },
        members: project.members.map((m) => ({
          user: m.user,
          role: m.role,
        })),
        progress,
        lastActivity: project.updatedAt.toISOString(),
        pendingConflicts: project._count.conflicts,
      };
    });

    return paginated(items, total, pagination.page, pagination.limit);
  } catch (error) {
    return handleApiError(error);
  }
}
// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const identity = await authenticateRequest(request);

    // Verify user exists/has access (if session)
    if (identity.type === "session") {
      const user = await db.user.findUnique({
        where: { id: identity.userId },
        select: { id: true },
      });

      if (!user) {
        throw new UnauthorizedError("User account not found.");
      }
    }

    const body = await request.json();
    const data = createProjectSchema.parse(body);

    // Generate unique slug
    const baseSlug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const slug = await generateUniqueSlug(baseSlug);

    // Create project
    const project = await db.project.create({
      data: {
        title: data.title,
        description: data.description,
        slug,
        organizationId: identity.organizationId,
        population: data.population,
        intervention: data.intervention,
        comparison: data.comparison,
        outcome: data.outcome,
        isPublic: data.isPublic,
        blindScreening: data.blindScreening,
        requireDualScreening: data.requireDualScreening,
        members: identity.type === "session" ? {
          create: {
            userId: identity.userId!,
            role: "OWNER",
          },
        } : undefined,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: {
            projectWorks: true,
            members: true,
          },
        },
      },
    });

    // Log activity (only if session)
    if (identity.type === "session") {
      await db.activity.create({
        data: {
          userId: identity.userId!,
          projectId: project.id,
          type: "PROJECT_CREATED",
          description: `Created project "${project.title}"`,
          metadata: {},
        },
      });
    }

    return created(project);
  } catch (error) {
    return handleApiError(error);
  }
}

// ============== HELPERS ==============

async function generateUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 0;

  while (true) {
    const existing = await db.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }

    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}



