
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
    handleApiError,
    UnauthorizedError,
    NotFoundError,
    ValidationError,
    success,
} from "@/lib/api";
import { BullMQIngestionQueue } from "@/infrastructure/jobs/ingestion-queue";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/rag/ingestion/retry
// Retry failed ingestion jobs
export async function POST(request: NextRequest, { params }: RouteParams) {
    let queue: BullMQIngestionQueue | null = null;
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId } = await params;

        // Only Leads/Owners can trigger retries
        const membership = await db.projectMember.findUnique({
            where: {
                projectId_userId: { projectId, userId: session.user.id }
            }
        });

        if (!membership || !['OWNER', 'LEAD'].includes(membership.role)) {
            throw new UnauthorizedError("Only project leads can retry ingestion jobs");
        }

        const body = await request.json().catch(() => ({}));
        const { specificWorkIds } = body as { specificWorkIds?: string[] };

        // Find failed works
        const whereClause: any = {
            projectId,
            ingestionStatus: 'FAILED',
            work: { url: { not: null } } // Only works with URLs (or PDFs) can be ingested
        };

        if (specificWorkIds && specificWorkIds.length > 0) {
            whereClause.workId = { in: specificWorkIds };
        }

        const failedWorks = await db.projectWork.findMany({
            where: whereClause,
            include: { work: true }
        });

        if (failedWorks.length === 0) {
            return success({ message: "No failed ingestion works found to retry", count: 0 });
        }

        // Initialize queue
        queue = new BullMQIngestionQueue();

        // Enqueue jobs
        let queuedCount = 0;
        for (const work of failedWorks) {
            // Check if we have a PDF capable source
            if (!work.pdfR2Key && !work.work.url) continue;

            await queue.enqueueIngestion({
                projectWorkId: work.id,
                workId: work.workId,
                source: 'manual_retry'
            });
            queuedCount++;
        }

        return success({
            message: `Queued ${queuedCount} works for ingestion retry`,
            count: queuedCount
        });

    } catch (error) {
        return handleApiError(error);
    } finally {
        if (queue) {
            await queue.close();
        }
    }
}
