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
} from "@/lib/api";
import {
  createAssessmentTool,
  getProjectTools,
  ROB2_TEMPLATE,
  ROBINS_I_TEMPLATE,
  NEWCASTLE_OTTAWA_COHORT_TEMPLATE,
} from "@/lib/services/quality-assessment";
import { QualityToolType } from "@prisma/client";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const createToolSchema = z.object({
  name: z.string().min(1, "Tool name is required"),
  type: z.enum(["ROB2", "ROBINS_I", "NEWCASTLE_OTTAWA", "GRADE", "CUSTOM"]),
  domains: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    questions: z.array(z.object({
      id: z.string(),
      text: z.string(),
      helpText: z.string().optional(),
      signallingQuestions: z.array(z.string()).optional(),
    })),
    scoringOptions: z.array(z.object({
      value: z.string(),
      label: z.string(),
      color: z.string(),
      weight: z.number().optional(),
    })),
  })).optional(),
});

// GET /api/projects/[id]/quality/tools - List quality assessment tools
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("active") !== "false";

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

    const tools = await getProjectTools(projectId, activeOnly);

    return success(tools);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/quality/tools - Create quality assessment tool
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Check project access (only leads can create tools)
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
      throw new ForbiddenError("Only project leads can create quality assessment tools");
    }

    const body = await request.json();
    const { name, type, domains } = createToolSchema.parse(body);

    const tool = await createAssessmentTool(projectId, {
      name,
      type: type as QualityToolType,
      domains,
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "PROJECT_UPDATED",
        description: `Created quality assessment tool "${name}" (${type})`,
        metadata: {
          action: "quality_tool_created",
          toolId: tool.id,
          toolType: type,
        },
      },
    });

    return created(tool);
  } catch (error) {
    return handleApiError(error);
  }
}


