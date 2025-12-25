import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  success, 
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

// GET /api/projects - List user's projects
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

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
    const where: Record<string, unknown> = {
      members: {
        some: {
          userId: session.user.id,
        },
      },
    };

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

    // Transform response
    const items = projects.map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      _count: {
        projectWorks: project._count.projectWorks,
        members: project._count.members,
      },
      members: project.members.map((m) => ({
        user: m.user,
        role: m.role,
      })),
      progress: calculateProgress(project._count),
      lastActivity: project.updatedAt.toISOString(),
      pendingConflicts: project._count.conflicts,
    }));

    return paginated(items, total, pagination.page, pagination.limit);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const data = createProjectSchema.parse(body);

    // Generate unique slug
    const baseSlug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    
    const slug = await generateUniqueSlug(baseSlug);

    // Create project with owner membership
    const project = await db.project.create({
      data: {
        title: data.title,
        description: data.description,
        slug,
        population: data.population,
        intervention: data.intervention,
        comparison: data.comparison,
        outcome: data.outcome,
        isPublic: data.isPublic,
        blindScreening: data.blindScreening,
        requireDualScreening: data.requireDualScreening,
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
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

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId: project.id,
        type: "PROJECT_CREATED",
        description: `Created project "${project.title}"`,
        metadata: {},
      },
    });

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

function calculateProgress(counts: { projectWorks: number }): number {
  // Simple progress calculation - can be enhanced
  if (counts.projectWorks === 0) return 0;
  return Math.min(100, Math.round((counts.projectWorks / 100) * 100));
}

