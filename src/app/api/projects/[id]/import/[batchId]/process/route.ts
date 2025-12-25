import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { 
  handleApiError, 
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  success,
} from "@/lib/api";
import { importFile } from "@/lib/services/import-service";

interface RouteParams {
  params: Promise<{ id: string; batchId: string }>;
}

// POST /api/projects/[id]/import/[batchId]/process - Process import with file content
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, batchId } = await params;

    // Check access
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
      throw new ForbiddenError("Only project leads can import studies");
    }

    // Get the import batch
    const batch = await db.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch || batch.projectId !== projectId) {
      throw new NotFoundError("Import batch");
    }

    if (batch.status !== "PENDING") {
      throw new ValidationError(`Import batch is already ${batch.status.toLowerCase()}`);
    }

    // Get file content from request body
    const body = await request.json();
    
    if (!body.content) {
      throw new ValidationError("Missing file content");
    }

    // Update batch to track who started the import
    await db.importBatch.update({
      where: { id: batchId },
      data: { uploadedById: session.user.id },
    });

    // Process the import
    const result = await importFile(batchId, body.content, batch.filename);

    return success({
      batchId,
      parseResult: {
        format: result.parseResult.format,
        stats: result.parseResult.stats,
        warnings: result.parseResult.warnings.slice(0, 10), // Limit warnings
        errors: result.parseResult.errors.slice(0, 10), // Limit errors
      },
      importResult: result.importResult,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

