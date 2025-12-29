import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  success,
} from "@/lib/api";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional().default("#3B82F6"),
});

// GET /api/projects/[id]/tags - Get all project tags
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

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

    // Get all unique tags for this project
    const tags = await db.studyTag.findMany({
      where: { projectId },
      select: {
        name: true,
        color: true,
      },
      distinct: ["name"],
      orderBy: { name: "asc" },
    });

    // Get usage count for each tag
    const tagsWithCount = await Promise.all(
      tags.map(async (tag) => {
        const count = await db.studyTag.count({
          where: {
            projectId,
            name: tag.name,
          },
        });
        return {
          ...tag,
          usageCount: count,
        };
      })
    );

    return success({ tags: tagsWithCount });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/tags - Create a new tag (applied to a study)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;
    const body = await request.json();
    
    const schema = z.object({
      projectWorkId: z.string(),
      name: z.string().min(1).max(50),
      color: z.string().regex(/^#[0-9A-F]{6}$/i).optional().default("#3B82F6"),
    });
    
    const data = schema.parse(body);

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

    // Verify project work belongs to this project
    const projectWork = await db.projectWork.findFirst({
      where: {
        id: data.projectWorkId,
        projectId,
      },
    });

    if (!projectWork) {
      throw new NotFoundError("Study not found in this project");
    }

    // Create tag (or ignore if duplicate due to unique constraint)
    const tag = await db.studyTag.create({
      data: {
        projectId,
        projectWorkId: data.projectWorkId,
        name: data.name,
        color: data.color,
        createdBy: session.user.id,
      },
    }).catch((error) => {
      // If duplicate, fetch existing
      if (error.code === "P2002") {
        return db.studyTag.findUnique({
          where: {
            projectWorkId_name: {
              projectWorkId: data.projectWorkId,
              name: data.name,
            },
          },
        });
      }
      throw error;
    });

    return success({
      id: tag!.id,
      name: tag!.name,
      color: tag!.color,
      projectWorkId: tag!.projectWorkId,
      createdAt: tag!.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

