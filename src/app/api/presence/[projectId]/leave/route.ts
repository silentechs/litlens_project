import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, NotFoundError } from "@/lib/api";
import { db } from "@/lib/db";
import { publishPresenceLeave } from "@/lib/events/publisher";

interface RouteParams {
    params: Promise<{ projectId: string }>;
}

// POST /api/presence/[projectId]/leave - Announce leaving
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { projectId } = await params;

        // Verify project membership
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

        // Broadcast presence leave
        publishPresenceLeave(projectId, session.user.id);

        return Response.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
