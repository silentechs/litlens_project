import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  success, 
  noContent,
} from "@/lib/api";
import { updateProjectSchema } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id] - Get a single project
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id },
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
        protocol: {
          select: {
            id: true,
            title: true,
            version: true,
            status: true,
            prosperoId: true,
          },
        },
        _count: {
          select: {
            projectWorks: true,
            members: true,
            conflicts: true,
            importBatches: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundError("Project");
    }

    // Check access
    const isMember = project.members.some((m) => m.userId === session.user.id);
    if (!isMember && !project.isPublic) {
      throw new ForbiddenError();
    }

    return success(project);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/projects/[id] - Update a project
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id } = await params;

    // Check access
    const membership = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError("Project");
    }

    if (!["OWNER", "LEAD"].includes(membership.role)) {
      throw new ForbiddenError("Only project owners and leads can update the project");
    }

    const body = await request.json();
    const data = updateProjectSchema.parse(body);

    const project = await db.project.update({
      where: { id },
      data: {
        ...data,
        archivedAt: data.status === "ARCHIVED" ? new Date() : undefined,
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
        type: "PROJECT_UPDATED",
        description: `Updated project "${project.title}"`,
        metadata: { changes: Object.keys(data) },
      },
    });

    return success(project);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id } = await params;

    // Check access - only owners can delete
    const membership = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError("Project");
    }

    if (membership.role !== "OWNER") {
      throw new ForbiddenError("Only project owners can delete the project");
    }

    // Soft delete by archiving, or hard delete
    await db.project.delete({
      where: { id },
    });

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

