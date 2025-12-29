import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  success,
  created,
  paginated,
  buildPaginationArgs,
} from "@/lib/api";
import {
  saveAssessment,
  getProjectAssessmentSummary,
  getStudyAssessmentProgress,
  calculateOverallScore,
  getAssessmentTool,
} from "@/lib/services/quality-assessment";
import { z } from "zod";
import { paginationSchema } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const saveAssessmentSchema = z.object({
  projectWorkId: z.string().cuid(),
  toolId: z.string().cuid(),
  domainScores: z.record(z.object({
    score: z.string(),
    justification: z.string(),
    answers: z.record(z.string()).optional(),
  })),
  overallScore: z.string().optional(),
  overallJustification: z.string().optional(),
  complete: z.boolean().default(false),
  autoCalculateOverall: z.boolean().default(true),
});

// GET /api/projects/[id]/quality/assessments - List assessments or get summary
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;
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

    // If requesting summary
    if (searchParams.get("summary") === "true") {
      const summary = await getProjectAssessmentSummary(projectId);
      return success(summary);
    }

    // If requesting progress for a tool
    const toolId = searchParams.get("toolId");
    if (toolId && searchParams.get("progress") === "true") {
      const progress = await getStudyAssessmentProgress(projectId, toolId);
      return success(progress);
    }

    // List assessments
    const pagination = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const status = searchParams.get("status");
    const projectWorkId = searchParams.get("projectWorkId");

    const where: Record<string, unknown> = { projectId };
    if (toolId) where.toolId = toolId;
    if (status) where.status = status;
    if (projectWorkId) where.projectWorkId = projectWorkId;

    const [total, assessments] = await Promise.all([
      db.qualityAssessment.count({ where }),
      db.qualityAssessment.findMany({
        where,
        ...buildPaginationArgs(pagination.page, pagination.limit),
        orderBy: { updatedAt: "desc" },
        include: {
          tool: {
            select: { id: true, name: true, type: true },
          },
          assessor: {
            select: { id: true, name: true, image: true },
          },
          projectWork: {
            include: {
              work: {
                select: { id: true, title: true, authors: true, year: true },
              },
            },
          },
        },
      }),
    ]);

    const formattedAssessments = assessments.map((a) => ({
      id: a.id,
      status: a.status,
      tool: a.tool,
      assessor: a.assessor,
      overallScore: a.overallScore,
      study: {
        id: a.projectWork.id,
        workId: a.projectWork.work.id,
        title: a.projectWork.work.title,
        authors: a.projectWork.work.authors,
        year: a.projectWork.work.year,
      },
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));

    return paginated(formattedAssessments, total, pagination.page, pagination.limit);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/quality/assessments - Save assessment
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    if (!["OWNER", "LEAD", "REVIEWER"].includes(membership.role)) {
      throw new ForbiddenError("You don't have permission to assess studies");
    }

    const body = await request.json();
    const {
      projectWorkId,
      toolId,
      domainScores,
      overallScore,
      overallJustification,
      complete,
      autoCalculateOverall
    } = saveAssessmentSchema.parse(body);

    // Verify study belongs to project
    const projectWork = await db.projectWork.findFirst({
      where: { id: projectWorkId, projectId, status: "INCLUDED" },
    });

    if (!projectWork) {
      throw new NotFoundError("Included study not found in this project");
    }

    // Verify tool belongs to project
    const tool = await getAssessmentTool(toolId);
    if (!tool || tool.projectId !== projectId) {
      throw new NotFoundError("Quality assessment tool not found");
    }

    // Auto-calculate overall score if requested
    let finalOverallScore = overallScore;
    if (autoCalculateOverall && !overallScore && complete) {
      finalOverallScore = calculateOverallScore(tool.domains, domainScores);
    }

    const result = await saveAssessment(
      projectId,
      projectWorkId,
      toolId,
      session.user.id,
      {
        domainScores,
        overallScore: finalOverallScore,
        overallJustification,
        complete,
      }
    );

    // Log activity if completed
    if (complete) {
      await db.activity.create({
        data: {
          userId: session.user.id,
          projectId,
          type: "QUALITY_ASSESSED",
          description: `Completed quality assessment using ${tool.name}`,
          metadata: {
            projectWorkId,
            toolId,
            assessmentId: result.id,
            overallScore: finalOverallScore,
          },
        },
      });
    }

    return created(result);
  } catch (error) {
    return handleApiError(error);
  }
}

