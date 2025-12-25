import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  created,
  paginated,
  buildPaginationArgs,
} from "@/lib/api";
import { 
  createExtractionTemplate, 
  type FieldDefinition 
} from "@/lib/services/extraction-service";
import { z } from "zod";
import { paginationSchema } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
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

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  fields: z.array(fieldDefinitionSchema).min(1, "At least one field is required"),
});

// GET /api/projects/[id]/extraction/templates - List extraction templates
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

    const activeOnly = searchParams.get("active") !== "false";

    const where = {
      projectId,
      ...(activeOnly ? { isActive: true } : {}),
    };

    const [total, templates] = await Promise.all([
      db.extractionTemplate.count({ where }),
      db.extractionTemplate.findMany({
        where,
        ...buildPaginationArgs(pagination.page, pagination.limit),
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { extractionData: true },
          },
        },
      }),
    ]);

    const formattedTemplates = templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      version: t.version,
      isActive: t.isActive,
      fieldCount: (t.fields as unknown as FieldDefinition[]).length,
      extractionCount: t._count.extractionData,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return paginated(formattedTemplates, total, pagination.page, pagination.limit);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/extraction/templates - Create extraction template
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Check project access (only leads can create templates)
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
      throw new ForbiddenError("Only project leads can create extraction templates");
    }

    const body = await request.json();
    const { name, description, fields } = createTemplateSchema.parse(body);

    const template = await createExtractionTemplate(projectId, {
      name,
      description,
      fields: fields as FieldDefinition[],
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "PROJECT_UPDATED",
        description: `Created extraction template "${name}"`,
        metadata: {
          action: "template_created",
          templateId: template.id,
          templateName: name,
        },
      },
    });

    return created(template);
  } catch (error) {
    return handleApiError(error);
  }
}

