import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  success,
} from "@/lib/api";
import { 
  getExtractionData,
  compareExtractions,
} from "@/lib/services/extraction-service";

interface RouteParams {
  params: Promise<{ id: string; projectWorkId: string }>;
}

// GET /api/projects/[id]/extraction/data/[projectWorkId] - Get extraction data for a study
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, projectWorkId } = await params;
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

    // Verify study belongs to project
    const projectWork = await db.projectWork.findFirst({
      where: { id: projectWorkId, projectId },
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
      },
    });

    if (!projectWork) {
      throw new NotFoundError("Study");
    }

    const templateId = searchParams.get("templateId") || undefined;

    // Get extractions
    const extractions = await getExtractionData(projectWorkId, templateId);

    // If compare mode, return comparison
    if (searchParams.get("compare") === "true" && templateId) {
      const comparison = await compareExtractions(projectWorkId, templateId);
      return success({
        work: projectWork.work,
        extractions,
        comparison,
      });
    }

    return success({
      work: projectWork.work,
      extractions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

