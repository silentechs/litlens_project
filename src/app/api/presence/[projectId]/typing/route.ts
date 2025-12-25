import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, NotFoundError } from "@/lib/api";
import { db } from "@/lib/db";
import { publishTypingIndicator } from "@/lib/events/publisher";
import { z } from "zod";

interface RouteParams {
    params: Promise<{ projectId: string }>;
}

const typingSchema = z.object({
    location: z.string(),
});

// POST /api/presence/[projectId]/typing - Broadcast typing indicator
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

        const body = await request.json();
        const { location } = typingSchema.parse(body);

        // Broadcast typing indicator
        publishTypingIndicator(
            projectId,
            {
                id: session.user.id,
                name: session.user.name || "Anonymous",
            },
            location
        );

        return Response.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
