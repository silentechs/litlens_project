import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  success,
} from "@/lib/api";
import { BullMQIngestionQueue } from "@/infrastructure/jobs/ingestion-queue";

interface RouteParams {
  params: Promise<{ id: string; projectWorkId: string }>;
}

// POST /api/projects/[id]/works/[projectWorkId]/pdf/fetch
// Attempts to fetch a PDF from the work metadata URL (if present), persist to R2, and ingest via the worker.
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
      throw new ForbiddenError("You don't have permission to fetch PDFs for this project");
    }

    const projectWork = await db.projectWork.findFirst({
      where: { id: projectWorkId, projectId },
      select: {
        id: true,
        workId: true,
        pdfR2Key: true,
        work: { select: { url: true } },
      },
    });

    if (!projectWork) throw new NotFoundError("Study");

    if (projectWork.pdfR2Key) {
      return success({
        message: "PDF is already attached to this study",
        pdfR2Key: projectWork.pdfR2Key,
      });
    }

    const url = projectWork.work.url;
    if (!url) {
      throw new ValidationError(
        "No PDF/source URL is available for this study. Upload a full-text PDF instead."
      );
    }

    // Enqueue ingestion. The worker will try:
    // - R2 (none yet)
    // - direct Work.url fetch (and will persist to R2 if it’s a PDF)
    const queue = new BullMQIngestionQueue();
    await queue.enqueueIngestion({
      projectWorkId,
      workId: projectWork.workId,
      source: "url_fetch",
    });
    await queue.close();

    return success({
      message: "Fetch + ingestion queued. Run the ingestion worker to process it.",
      url,
    });
  } catch (error) {
    return handleApiError(error);
  }
}


