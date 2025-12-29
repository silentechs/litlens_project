import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  success,
} from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string; tagId: string }>;
}

// DELETE /api/projects/[id]/tags/[tagId] - Delete a tag
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, tagId } = await params;

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

    // Verify tag belongs to this project
    const tag = await db.studyTag.findFirst({
      where: {
        id: tagId,
        projectId,
      },
    });

    if (!tag) {
      throw new NotFoundError("Tag");
    }

    // Delete tag
    await db.studyTag.delete({
      where: { id: tagId },
    });

    return success({
      message: "Tag deleted successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

