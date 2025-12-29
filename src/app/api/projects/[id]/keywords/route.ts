import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  success,
} from "@/lib/api";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateKeywordsSchema = z.object({
  keywords: z.array(z.string().min(1).max(100)),
});

// PATCH /api/projects/[id]/keywords - Update highlight keywords
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;
    const body = await request.json();
    const { keywords } = updateKeywordsSchema.parse(body);

    // Check project access - only leads can update keywords
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
      throw new ForbiddenError("Only project leads can update keywords");
    }

    // Update keywords
    const project = await db.project.update({
      where: { id: projectId },
      data: { highlightKeywords: keywords },
      select: {
        id: true,
        title: true,
        highlightKeywords: true,
      },
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "PROJECT_UPDATED",
        description: `Updated highlight keywords`,
        metadata: {
          keywords: keywords,
          previousCount: keywords.length,
        },
      },
    });

    return success({
      id: project.id,
      title: project.title,
      highlightKeywords: project.highlightKeywords,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/projects/[id]/keywords - Get highlight keywords
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

    // Get keywords
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        highlightKeywords: true,
      },
    });

    if (!project) {
      throw new NotFoundError("Project");
    }

    return success({
      keywords: project.highlightKeywords,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

