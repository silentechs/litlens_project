import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  success,
  paginated,
  buildPaginationArgs,
} from "@/lib/api";
import { resolveDiscrepancy } from "@/lib/services/extraction-service";
import { z } from "zod";
import { paginationSchema } from "@/lib/validators";
import { DiscrepancyStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/extraction/discrepancies - List discrepancies
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

    const pagination = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const status = searchParams.get("status") as DiscrepancyStatus | null;

    const where = {
      extraction: { projectId },
      ...(status ? { status } : {}),
    };

    const [total, discrepancies] = await Promise.all([
      db.extractionDiscrepancy.count({ where }),
      db.extractionDiscrepancy.findMany({
        where,
        ...buildPaginationArgs(pagination.page, pagination.limit),
        orderBy: { createdAt: "desc" },
        include: {
          extraction: {
            include: {
              template: {
                select: { id: true, name: true, fields: true },
              },
              projectWork: {
                include: {
                  work: {
                    select: { id: true, title: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const formattedDiscrepancies = discrepancies.map((d) => {
      const fields = d.extraction.template.fields as Array<{ id: string; label: string }>;
      const field = fields.find((f) => f.id === d.fieldName);

      return {
        id: d.id,
        fieldName: d.fieldName,
        fieldLabel: field?.label || d.fieldName,
        value1: d.value1 ? JSON.parse(d.value1) : null,
        value2: d.value2 ? JSON.parse(d.value2) : null,
        status: d.status,
        resolvedValue: d.resolvedValue ? JSON.parse(d.resolvedValue) : null,
        resolvedBy: d.resolvedBy,
        resolvedAt: d.resolvedAt?.toISOString() || null,
        study: {
          id: d.extraction.projectWork.id,
          workId: d.extraction.projectWork.work.id,
          title: d.extraction.projectWork.work.title,
        },
        template: {
          id: d.extraction.template.id,
          name: d.extraction.template.name,
        },
        createdAt: d.createdAt.toISOString(),
      };
    });

    return paginated(formattedDiscrepancies, total, pagination.page, pagination.limit);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/extraction/discrepancies - Resolve discrepancy
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Check project access (only leads can resolve)
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
      throw new ForbiddenError("Only project leads can resolve discrepancies");
    }

    const bodySchema = z.object({
      discrepancyId: z.string().cuid(),
      resolvedValue: z.unknown(),
      applyToExtraction: z.boolean().default(true),
    });

    const body = await request.json();
    const { discrepancyId, resolvedValue, applyToExtraction } = bodySchema.parse(body);

    // Verify discrepancy belongs to this project
    const discrepancy = await db.extractionDiscrepancy.findUnique({
      where: { id: discrepancyId },
      include: {
        extraction: {
          select: { projectId: true },
        },
      },
    });

    if (!discrepancy || discrepancy.extraction.projectId !== projectId) {
      throw new NotFoundError("Discrepancy");
    }

    await resolveDiscrepancy(discrepancyId, session.user.id, resolvedValue, applyToExtraction);

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "EXTRACTION_COMPLETED",
        description: `Resolved extraction discrepancy`,
        metadata: {
          action: "discrepancy_resolved",
          discrepancyId,
          fieldName: discrepancy.fieldName,
        },
      },
    });

    return success({ message: "Discrepancy resolved" });
  } catch (error) {
    return handleApiError(error);
  }
}

