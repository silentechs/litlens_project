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
import { getExtractionTemplate, type FieldDefinition } from "@/lib/services/extraction-service";
import { 
  extractFromAbstract,
  extractOutcomeData,
  extractPopulationData,
  suggestFieldValue,
} from "@/lib/services/ai-extraction";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const extractionRequestSchema = z.object({
  workId: z.string().cuid(),
  templateId: z.string().cuid().optional(),
  type: z.enum(["full", "outcomes", "population", "field"]).default("full"),
  fieldId: z.string().optional(), // For single field extraction
  existingData: z.record(z.unknown()).optional(), // Context for field extraction
});

// POST /api/projects/[id]/extraction/ai-assist - Get AI extraction suggestions
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
      throw new ForbiddenError("You don't have permission to use AI extraction");
    }

    const body = await request.json();
    const { workId, templateId, type, fieldId, existingData } = extractionRequestSchema.parse(body);

    // Verify work belongs to an included study in this project
    const projectWork = await db.projectWork.findFirst({
      where: {
        projectId,
        workId,
        status: "INCLUDED",
      },
    });

    if (!projectWork) {
      throw new NotFoundError("Included study not found in this project");
    }

    // Get study text
    const work = await db.work.findUnique({
      where: { id: workId },
      select: {
        title: true,
        abstract: true,
        authors: true,
        year: true,
        journal: true,
        keywords: true,
      },
    });

    if (!work) {
      throw new NotFoundError("Work");
    }

    const studyText = `
Title: ${work.title}

Abstract: ${work.abstract || "No abstract available"}

Authors: ${(work.authors as Array<{ name: string }>)?.map((a) => a.name).join(", ") || "Unknown"}

Year: ${work.year || "Unknown"}

Journal: ${work.journal || "Unknown"}

Keywords: ${(work.keywords as string[])?.join(", ") || "None"}
`.trim();

    let result: unknown;

    switch (type) {
      case "full":
        if (!templateId) {
          throw new Error("templateId is required for full extraction");
        }
        
        const template = await getExtractionTemplate(templateId);
        if (!template || template.projectId !== projectId) {
          throw new NotFoundError("Template");
        }

        result = await extractFromAbstract(workId, template.fields);
        break;

      case "outcomes":
        result = await extractOutcomeData(studyText);
        break;

      case "population":
        result = await extractPopulationData(studyText);
        break;

      case "field":
        if (!fieldId || !templateId) {
          throw new Error("fieldId and templateId are required for field extraction");
        }

        const fieldTemplate = await getExtractionTemplate(templateId);
        if (!fieldTemplate || fieldTemplate.projectId !== projectId) {
          throw new NotFoundError("Template");
        }

        const field = fieldTemplate.fields.find((f: FieldDefinition) => f.id === fieldId);
        if (!field) {
          throw new NotFoundError("Field");
        }

        result = await suggestFieldValue(workId, field, existingData || {});
        break;
    }

    return success({
      type,
      result,
      workId,
      templateId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

