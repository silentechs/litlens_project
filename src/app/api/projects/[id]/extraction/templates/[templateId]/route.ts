import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  success,
  noContent,
} from "@/lib/api";
import { 
  getExtractionTemplate, 
  updateExtractionTemplate,
  type FieldDefinition 
} from "@/lib/services/extraction-service";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string; templateId: string }>;
}

// Field definition schema
const fieldDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum([
    "text", "textarea", "number", "integer", "boolean", 
    "date", "select", "multiselect", "radio", "checkbox", 
    "range", "calculated", "json"
  ]),
  description: z.string().optional(),
  required: z.boolean().default(false),
  validation: z.array(z.object({
    type: z.enum(["required", "min", "max", "minLength", "maxLength", "pattern", "email", "url", "custom"]),
    value: z.unknown().optional(),
    message: z.string(),
  })).optional(),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })).optional(),
  conditional: z.object({
    field: z.string(),
    operator: z.enum(["equals", "notEquals", "contains", "greaterThan", "lessThan", "isEmpty", "isNotEmpty"]),
    value: z.unknown().optional(),
  }).optional(),
  defaultValue: z.unknown().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  fields: z.array(fieldDefinitionSchema).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/projects/[id]/extraction/templates/[templateId] - Get template details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, templateId } = await params;

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

    const template = await getExtractionTemplate(templateId);

    if (!template || template.projectId !== projectId) {
      throw new NotFoundError("Template");
    }

    return success(template);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/projects/[id]/extraction/templates/[templateId] - Update template
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, templateId } = await params;

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

    if (!["OWNER", "LEAD"].includes(membership.role)) {
      throw new ForbiddenError("Only project leads can update extraction templates");
    }

    // Verify template belongs to project
    const existing = await db.extractionTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundError("Template");
    }

    const body = await request.json();
    const data = updateTemplateSchema.parse(body);

    // Handle isActive separately from other updates
    if (data.isActive !== undefined) {
      await db.extractionTemplate.update({
        where: { id: templateId },
        data: { isActive: data.isActive },
      });
    }

    // Update other fields if provided
    if (data.name || data.description || data.fields) {
      await updateExtractionTemplate(templateId, {
        name: data.name,
        description: data.description,
        fields: data.fields as FieldDefinition[] | undefined,
      });
    }

    const updated = await getExtractionTemplate(templateId);

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "PROJECT_UPDATED",
        description: `Updated extraction template "${existing.name}"`,
        metadata: {
          action: "template_updated",
          templateId,
          templateName: updated?.name || existing.name,
        },
      },
    });

    return success(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/projects/[id]/extraction/templates/[templateId] - Deactivate template
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, templateId } = await params;

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

    if (!["OWNER", "LEAD"].includes(membership.role)) {
      throw new ForbiddenError("Only project leads can delete extraction templates");
    }

    const template = await db.extractionTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || template.projectId !== projectId) {
      throw new NotFoundError("Template");
    }

    // Check if template has extraction data
    const hasData = await db.extractionData.count({
      where: { templateId },
    });

    if (hasData > 0) {
      // Just deactivate instead of deleting
      await db.extractionTemplate.update({
        where: { id: templateId },
        data: { isActive: false },
      });
    } else {
      // Safe to delete
      await db.extractionTemplate.delete({
        where: { id: templateId },
      });
    }

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "PROJECT_UPDATED",
        description: `${hasData > 0 ? "Deactivated" : "Deleted"} extraction template "${template.name}"`,
        metadata: {
          action: hasData > 0 ? "template_deactivated" : "template_deleted",
          templateId,
          templateName: template.name,
        },
      },
    });

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

