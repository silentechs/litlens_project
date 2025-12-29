import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, NotFoundError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

interface RouteParams {
    params: Promise<{ id: string; messageId: string }>;
}

const reactionSchema = z.object({
    emoji: z.string().regex(/^[\p{Emoji}]+$/u, "Invalid emoji"),
});

// POST /api/projects/[id]/chat/messages/[messageId]/reactions - Add reaction
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId, messageId } = await params;

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

        // Verify message exists
        const message = await db.chatMessage.findUnique({
            where: { id: messageId },
        });

        if (!message || message.projectId !== projectId) {
            throw new NotFoundError("Message");
        }

        const body = await request.json();
        const { emoji } = reactionSchema.parse(body);

        // Create or update reaction (upsert)
        const reaction = await db.chatReaction.upsert({
            where: {
                messageId_userId_emoji: {
                    messageId,
                    userId: session.user.id,
                    emoji,
                },
            },
            create: {
                messageId,
                userId: session.user.id,
                emoji,
            },
            update: {
                // Reaction already exists, just update timestamp
                createdAt: new Date(),
            },
        });

        return Response.json({
            success: true,
            data: {
                id: reaction.id,
                emoji: reaction.emoji,
                userId: reaction.userId,
            },
        });
    } catch (error) {
        return handleApiError(error);
    }
}

// DELETE /api/projects/[id]/chat/messages/[messageId]/reactions - Remove reaction
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId, messageId } = await params;

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

        // Get emoji from query params
        const url = new URL(request.url);
        const emoji = url.searchParams.get("emoji");

        if (!emoji) {
            throw new NotFoundError("Emoji parameter required");
        }

        // Delete reaction
        await db.chatReaction.deleteMany({
            where: {
                messageId,
                userId: session.user.id,
                emoji,
            },
        });

        return Response.json({
            success: true,
            message: "Reaction removed",
        });
    } catch (error) {
        return handleApiError(error);
    }
}

// GET /api/projects/[id]/chat/messages/[messageId]/reactions - Get all reactions for message
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId, messageId } = await params;

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

        // Get reactions with user info
        const reactions = await db.chatReaction.findMany({
            where: { messageId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        // Group by emoji
        const grouped = reactions.reduce((acc, reaction) => {
            if (!acc[reaction.emoji]) {
                acc[reaction.emoji] = [];
            }
            acc[reaction.emoji].push({
                userId: reaction.userId,
                userName: reaction.user.name || "Unknown User",
                userImage: reaction.user.image,
            });
            return acc;
        }, {} as Record<string, Array<{ userId: string; userName: string; userImage: string | null }>>);

        return Response.json({
            success: true,
            data: grouped,
        });
    } catch (error) {
        return handleApiError(error);
    }
}

