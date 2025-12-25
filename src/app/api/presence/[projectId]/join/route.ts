import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, NotFoundError } from "@/lib/api";
import { db } from "@/lib/db";
import {
    publishPresenceJoin
} from "@/lib/events/publisher";

interface RouteParams {
    params: Promise<{ projectId: string }>;
}

// POST /api/presence/[projectId]/join - Announce presence
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

        // Broadcast presence join
        publishPresenceJoin(projectId, {
            id: session.user.id,
            name: session.user.name || "Anonymous",
            avatar: session.user.image || undefined,
        });

        return Response.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
