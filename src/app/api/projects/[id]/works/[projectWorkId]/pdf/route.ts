import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadFile } from "@/lib/r2";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  created,
} from "@/lib/api";
import { BullMQIngestionQueue } from "@/infrastructure/jobs/ingestion-queue";

interface RouteParams {
  params: Promise<{ id: string; projectWorkId: string }>;
}

// POST /api/projects/[id]/works/[projectWorkId]/pdf
// Upload a full-text PDF and attach it to a study (ProjectWork), then enqueue ingestion.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId, projectWorkId } = await params;

    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: session.user.id } },
    });
    if (!membership) throw new NotFoundError("Project");

    if (!["OWNER", "LEAD", "REVIEWER"].includes(membership.role)) {
      throw new ForbiddenError("You don't have permission to upload PDFs for this project");
    }

    const projectWork = await db.projectWork.findFirst({
      where: { id: projectWorkId, projectId },
      select: { id: true, workId: true },
    });
    if (!projectWork) throw new NotFoundError("Study");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new ValidationError("No file provided");
    }

    // Validate file type and size
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      throw new ValidationError("File size exceeds 50MB limit");
    }

    const filename = file.name || "fulltext.pdf";
    const contentType = file.type || "application/pdf";
    const looksPdf = contentType.includes("pdf") || filename.toLowerCase().endsWith(".pdf");
    if (!looksPdf) {
      throw new ValidationError("Only PDF files are supported");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Stable key per projectWork (re-uploads overwrite; jobId uses pdfUploadedAt versioning)
    const key = `pdfs/${projectId}/${projectWorkId}.pdf`;

    await uploadFile({
      key,
      body: buffer,
      contentType: "application/pdf",
      metadata: {
        projectId,
        projectWorkId,
        workId: projectWork.workId,
        originalName: filename,
        uploadedBy: session.user.id,
        uploadedAt: new Date().toISOString(),
        source: "manual_upload",
      },
    });

    // Persist linkage on ProjectWork for downstream ingestion/retrieval and for UI status
    await db.projectWork.update({
      where: { id: projectWorkId },
      data: {
        pdfR2Key: key,
        pdfUploadedAt: new Date(),
        pdfFileSize: file.size,
        pdfSource: "manual_upload",
        ingestionStatus: "PENDING",
        ingestionError: null,
      },
    });

    // Enqueue ingestion (async, durable)
    try {
      const queue = new BullMQIngestionQueue();
      await queue.enqueueIngestion({
        projectWorkId,
        workId: projectWork.workId,
        source: "manual_upload",
      });
      await queue.close();
    } catch (e) {
      // Do not fail upload if enqueue fails; caller can retry.
      console.error("[Ingestion] Failed to enqueue after PDF upload", e);
    }

    return created({
      projectWorkId,
      key,
      size: file.size,
      contentType: "application/pdf",
      message: "PDF uploaded and ingestion queued",
    });
  } catch (error) {
    return handleApiError(error);
  }
}


