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
  saveExtractionData, 
  getExtractionProgress,
} from "@/lib/services/extraction-service";
import { z } from "zod";
import { paginationSchema } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const saveExtractionSchema = z.object({
  projectWorkId: z.string().cuid(),
  templateId: z.string().cuid(),
  data: z.record(z.unknown()),
  validate: z.boolean().default(true),
  complete: z.boolean().default(false),
});

// GET /api/projects/[id]/extraction/data - Get extraction data (with progress)
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

    // If requesting progress summary
    if (searchParams.get("summary") === "true") {
      const progress = await getExtractionProgress(projectId);
      return success(progress);
    }

    // Pagination
    const pagination = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    // Filters
    const status = searchParams.get("status");
    const templateId = searchParams.get("templateId");
    const extractorId = searchParams.get("extractorId");

    const where: Record<string, unknown> = { projectId };
    if (status) where.status = status;
    if (templateId) where.templateId = templateId;
    if (extractorId) where.extractorId = extractorId;

    const [total, extractions] = await Promise.all([
      db.extractionData.count({ where }),
      db.extractionData.findMany({
        where,
        ...buildPaginationArgs(pagination.page, pagination.limit),
        orderBy: { updatedAt: "desc" },
        include: {
          template: {
            select: { id: true, name: true },
          },
          extractor: {
            select: { id: true, name: true, image: true },
          },
          projectWork: {
            include: {
              work: {
                select: { id: true, title: true, authors: true, year: true },
              },
            },
          },
          _count: {
            select: { discrepancies: true },
          },
        },
      }),
    ]);

    const formattedExtractions = extractions.map((e) => ({
      id: e.id,
      projectWorkId: e.projectWorkId,
      status: e.status,
      isValid: e.isValid,
      template: e.template,
      extractor: e.extractor,
      work: {
        id: e.projectWork.work.id,
        title: e.projectWork.work.title,
        authors: e.projectWork.work.authors,
        year: e.projectWork.work.year,
      },
      discrepancyCount: e._count.discrepancies,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));

    return paginated(formattedExtractions, total, pagination.page, pagination.limit);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/extraction/data - Save extraction data
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
      throw new ForbiddenError("You don't have permission to extract data");
    }

    const body = await request.json();
    const { projectWorkId, templateId, data, validate, complete } = saveExtractionSchema.parse(body);

    // Verify study belongs to project and is included
    const projectWork = await db.projectWork.findFirst({
      where: { id: projectWorkId, projectId, status: "INCLUDED" },
    });

    if (!projectWork) {
      throw new NotFoundError("Included study not found in this project");
    }

    // Verify template belongs to project
    const template = await db.extractionTemplate.findFirst({
      where: { id: templateId, projectId, isActive: true },
    });

    if (!template) {
      throw new NotFoundError("Active template not found in this project");
    }

    const result = await saveExtractionData(
      projectId,
      projectWorkId,
      templateId,
      session.user.id,
      data,
      { validate, complete }
    );

    // Log activity if completed
    if (complete) {
      await db.activity.create({
        data: {
          userId: session.user.id,
          projectId,
          type: "EXTRACTION_COMPLETED",
          description: `Completed data extraction for study`,
          metadata: {
            projectWorkId,
            templateId,
            extractionId: result.id,
            isValid: result.isValid,
          },
        },
      });
    }

    return created(result);
  } catch (error) {
    return handleApiError(error);
  }
}

