import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  success,
} from "@/lib/api";
import { 
  generateProjectSuggestions, 
  getScreeningSuggestion 
} from "@/lib/services/ai-screening";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/screening/ai-suggestions - Generate AI suggestions
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Check project access and role (only leads can trigger AI generation)
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
      throw new ForbiddenError("Only project leads can generate AI suggestions");
    }

    // Parse options from request body
    const bodySchema = z.object({
      phase: z.enum(["TITLE_ABSTRACT", "FULL_TEXT"]).optional(),
      limit: z.number().min(1).max(500).optional(),
    });

    const body = await request.json().catch(() => ({}));
    const { phase, limit } = bodySchema.parse(body);

    // Generate suggestions
    const result = await generateProjectSuggestions(projectId, { phase, limit });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "PROJECT_UPDATED",
        description: `Generated AI suggestions for ${result.processed} studies`,
        metadata: {
          action: "ai_suggestions_generated",
          processed: result.processed,
          phase,
        },
      },
    });

    return success({
      message: `Generated AI suggestions for ${result.processed} studies`,
      ...result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/projects/[id]/screening/ai-suggestions - Get AI suggestion for specific study
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const projectWorkId = searchParams.get("projectWorkId");

    if (!projectWorkId) {
      throw new Error("projectWorkId is required");
    }

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

    // Get the study
    const projectWork = await db.projectWork.findFirst({
      where: {
        id: projectWorkId,
        projectId,
      },
      include: {
        work: {
          select: {
            title: true,
            abstract: true,
            authors: true,
            year: true,
            journal: true,
            keywords: true,
          },
        },
        project: {
          include: {
            protocol: true,
          },
        },
      },
    });

    if (!projectWork) {
      throw new NotFoundError("Study");
    }

    // If already has AI suggestion, return it
    if (projectWork.aiSuggestion) {
      return success({
        decision: projectWork.aiSuggestion,
        confidence: projectWork.aiConfidence,
        reasoning: projectWork.aiReasoning,
        cached: true,
      });
    }

    // Generate new suggestion
    const protocolContent = (projectWork.project.protocol?.content || {}) as Record<string, unknown>;
    const criteria = {
      inclusionCriteria: (protocolContent.inclusionCriteria as string[]) || [],
      exclusionCriteria: (protocolContent.exclusionCriteria as string[]) || [],
      pico: protocolContent.pico as {
        population?: string;
        intervention?: string;
        comparison?: string;
        outcome?: string;
      },
      studyTypes: (protocolContent.studyTypes as string[]) || [],
    };

    const suggestion = await getScreeningSuggestion(
      {
        title: projectWork.work.title,
        abstract: projectWork.work.abstract,
        authors: (projectWork.work.authors as Array<{ name: string }>) || [],
        year: projectWork.work.year,
        journal: projectWork.work.journal,
        keywords: (projectWork.work.keywords as string[]) || [],
      },
      criteria
    );

    // Cache the suggestion
    await db.projectWork.update({
      where: { id: projectWorkId },
      data: {
        aiSuggestion: suggestion.decision,
        aiConfidence: suggestion.confidence,
        aiReasoning: suggestion.reasoning,
      },
    });

    return success({
      ...suggestion,
      cached: false,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

