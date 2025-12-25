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

interface RouteParams {
  params: Promise<{ id: string; batchId: string }>;
}

// GET /api/projects/[id]/import/[batchId] - Get import batch details
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get the import batch with statistics
    const batch = await db.importBatch.findUnique({
      where: { id: batchId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        _count: {
          select: {
            projectWorks: true,
          },
        },
      },
    });

    if (!batch || batch.projectId !== projectId) {
      throw new NotFoundError("Import batch");
    }

    return success({
      id: batch.id,
      projectId: batch.projectId,
      filename: batch.filename,
      fileSize: batch.fileSize,
      fileType: batch.fileType,
      status: batch.status,
      totalRecords: batch.totalRecords,
      processedRecords: batch.processedRecords,
      duplicatesFound: batch.duplicatesFound,
      errorsCount: batch.errorsCount,
      errorLog: batch.errorLog,
      uploadedBy: batch.uploadedBy,
      worksCreated: batch._count.projectWorks,
      createdAt: batch.createdAt.toISOString(),
      startedAt: batch.startedAt?.toISOString() || null,
      completedAt: batch.completedAt?.toISOString() || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/projects/[id]/import/[batchId] - Delete import batch and its records
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, batchId } = await params;

    // Check access - only owners and leads can delete
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
      throw new ForbiddenError("Only project owners and leads can delete imports");
    }

    // Get the batch
    const batch = await db.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch || batch.projectId !== projectId) {
      throw new NotFoundError("Import batch");
    }

    // Delete associated project works and the batch in a transaction
    await db.$transaction(async (tx) => {
      // Delete project works from this batch
      await tx.projectWork.deleteMany({
        where: { importBatchId: batchId },
      });

      // Delete the batch
      await tx.importBatch.delete({
        where: { id: batchId },
      });
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "IMPORT_DELETED",
        description: `Deleted import batch "${batch.filename}"`,
        metadata: {
          batchId,
          filename: batch.filename,
          recordsDeleted: batch.processedRecords,
        },
      },
    });

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

