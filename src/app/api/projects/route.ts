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

    // Fetch progress stats for these projects
    const projectIds = projects.map((p: { id: string }) => p.id);
    const progressStats = await db.projectWork.groupBy({
      by: ['projectId', 'status'],
      where: {
        projectId: { in: projectIds }
      },
      _count: true
    });

    // Transform response and apply self-healing for stuck statuses
    const items = await Promise.all(projects.map(async (project: any) => {
      // --- SELF-HEALING BLOCK ---
      // Fix studies where decisions exist but status is still PENDING
      // This ensures progress is reported correctly even if individual project pages haven't been visited
      const stuckStudies = await db.projectWork.findMany({
        where: {
          projectId: project.id,
          status: "PENDING",
          decisions: { some: {} }
        },
        include: { decisions: true }
      });

      if (stuckStudies.length > 0) {
        const membersCount = await db.projectMember.count({ where: { projectId: project.id } });

        for (const study of stuckStudies) {
          if (study.decisions.length > 0) {
            const latest = study.decisions[0];
            // Only auto-fix if it's safe (single-reviewer mode, 1 person project, or multiple decisions exist)
            if (!project.requireDualScreening || membersCount === 1 || study.decisions.length >= 2) {
              await db.projectWork.update({
                where: { id: study.id },
                data: {
                  status: latest.decision === "INCLUDE" ? "INCLUDED" :
                    latest.decision === "EXCLUDE" ? "EXCLUDED" : "MAYBE",
                  finalDecision: latest.decision
                }
              });
            }
          }
        }

        // Refresh progress stats for this project since we updated some statuses
        const updatedStats = await db.projectWork.groupBy({
          by: ['status'],
          where: { projectId: project.id },
          _count: true
        });

        // Update the local stats for this project
        progressStats.push(...updatedStats.map((s: any) => ({ ...s, projectId: project.id })));
      }
      // --------------------------

      // Calculate real progress
      const stats = progressStats.filter((s: any) => s.projectId === project.id);
      const totalWorks = project._count.projectWorks;

      const completedCount = stats.reduce((acc: number, curr: any) => {
        if (["INCLUDED", "EXCLUDED", "MAYBE"].includes(curr.status)) {
          return acc + curr._count;
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
        members: project.members.map((m: any) => ({
          user: m.user,
          role: m.role,
        })),
        progress,
        lastActivity: project.updatedAt.toISOString(),
        pendingConflicts: project._count.conflicts,
      };
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

    // Verify user exists in database (important for JWT auth)
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });

    if (!user) {
      console.error("[API] User from session not found in DB:", session.user.id);
      throw new UnauthorizedError("User account not found. Please sign out and sign in again.");
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



