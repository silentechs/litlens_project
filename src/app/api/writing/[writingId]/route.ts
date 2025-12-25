import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  success,
  noContent,
} from "@/lib/api";
import {
  getWritingProject,
  updateWritingContent,
  updateWritingProject,
  deleteWritingProject,
  exportWritingProject,
} from "@/lib/services/writing-projects";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ writingId: string }>;
}

const updateWritingSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.object({
    type: z.literal("doc"),
    content: z.array(z.unknown()),
  }).optional(),
  citationStyle: z.string().optional(),
  targetLength: z.number().positive().optional(),
  status: z.enum(["DRAFT", "IN_PROGRESS", "REVIEW", "COMPLETE"]).optional(),
});

// GET /api/writing/[writingId] - Get writing project details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { writingId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format") as "markdown" | "html" | "docx" | "text" | null;

    // If format specified, export
    if (format) {
      const exported = await exportWritingProject(writingId, session.user.id, format);
      const contentTypes: Record<string, string> = {
        html: "text/html",
        markdown: "text/markdown",
        text: "text/plain",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
      return new Response(exported, {
        headers: { "Content-Type": contentTypes[format] || "text/plain" },
      });
    }

    const project = await getWritingProject(writingId, session.user.id);

    if (!project) {
      throw new NotFoundError("Writing project");
    }

    return success({
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/writing/[writingId] - Update writing project
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { writingId } = await params;
    const body = await request.json();
    const data = updateWritingSchema.parse(body);

    // Update content if provided
    if (data.content) {
      await updateWritingContent(writingId, session.user.id, data.content as unknown as import("@/lib/services/writing-projects").WritingContent);
    }

    // Update metadata if any provided
    const metadataUpdates: Record<string, unknown> = {};
    if (data.title) metadataUpdates.title = data.title;
    if (data.citationStyle) metadataUpdates.citationStyle = data.citationStyle;
    if (data.targetLength) metadataUpdates.targetLength = data.targetLength;
    if (data.status) metadataUpdates.status = data.status;

    if (Object.keys(metadataUpdates).length > 0) {
      await updateWritingProject(writingId, session.user.id, metadataUpdates);
    }

    return success({ id: writingId, updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/writing/[writingId] - Delete writing project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { writingId } = await params;

    await deleteWritingProject(writingId, session.user.id);

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

