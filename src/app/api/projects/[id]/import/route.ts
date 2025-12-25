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
  created,
  paginated,
} from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/import - Get import batches
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

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

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const total = await db.importBatch.count({ where: { projectId } });

    const batches = await db.importBatch.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginated(
      batches.map((b: any) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
        startedAt: b.startedAt?.toISOString() || null,
        completedAt: b.completedAt?.toISOString() || null,
      })),
      total,
      page,
      limit
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/import - Start an import (with file info)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Check access - only leads can import
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

    const body = await request.json();

    // Validate input
    if (!body.filename || !body.fileType) {
      throw new ValidationError("Missing required fields: filename, fileType");
    }

    const validTypes = ["ris", "bib", "bibtex", "csv", "xml", "nbib", "txt"];
    const ext = body.fileType.toLowerCase();

    // Note: some libs use 'ris', others may strip extensions. Simple loose check.
    if (!validTypes.includes(ext) && !["ris", "text/plain"].includes(ext)) {
      // Relaxed check for now
    }

    // Create import batch
    const batch = await db.importBatch.create({
      data: {
        projectId,
        filename: body.filename,
        fileSize: body.fileSize || 0,
        fileType: body.fileType.toLowerCase(),
        status: "PENDING",
      },
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "STUDY_IMPORTED",
        description: `Started import of ${body.filename}`,
        metadata: {
          batchId: batch.id,
          filename: body.filename,
          fileType: body.fileType,
        },
      },
    });

    // If key is provided found, process immediately (Synchronous for now)
    if (body.key) {
      try {
        const { downloadFile } = await import("@/lib/r2");
        const { importFile } = await import("@/lib/services/import-service");

        const fileBuffer = await downloadFile(body.key);
        const fileContent = fileBuffer.toString("utf-8"); // Assuming text-based research files

        const result = await importFile(batch.id, fileContent, body.filename);

        return success({
          ...batch,
          ...result.importResult,
          createdAt: batch.createdAt.toISOString(),
        });
      } catch (err) {
        console.error("Import processing error:", err);
        // Update batch to failed
        await db.importBatch.update({
          where: { id: batch.id },
          data: { status: "FAILED" }
        });
        throw new ValidationError("Failed to process import file");
      }
    }

    return created({
      ...batch,
      createdAt: batch.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// Note: Import processing is handled by the import-service
// See: src/lib/services/import-service.ts
