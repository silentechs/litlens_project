import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, NotFoundError } from "@/lib/api";
import { db } from "@/lib/db";

interface RouteParams {
    params: Promise<{ id: string; messageId: string }>;
}

// POST /api/projects/[id]/chat/messages/[messageId]/read - Mark message as read
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

        // Don't mark own messages as read
        if (message.userId === session.user.id) {
            return Response.json({
                success: true,
                message: "Cannot mark own message as read",
            });
        }

        // Create read receipt (upsert to handle duplicates)
        const receipt = await db.chatReadReceipt.upsert({
            where: {
                messageId_userId: {
                    messageId,
                    userId: session.user.id,
                },
            },
            create: {
                messageId,
                userId: session.user.id,
            },
            update: {
                readAt: new Date(),
            },
        });

        return Response.json({
            success: true,
            data: {
                id: receipt.id,
                readAt: receipt.readAt,
            },
        });
    } catch (error) {
        return handleApiError(error);
    }
}

// POST /api/projects/[id]/chat/messages/[messageId]/read (batch) - Mark multiple messages as read
// This is called when user scrolls through chat
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId } = await params;

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
        const { messageIds } = body as { messageIds: string[] };

        if (!messageIds || !Array.isArray(messageIds)) {
            throw new NotFoundError("messageIds array required");
        }

        // Mark all messages as read (skip own messages)
        const messages = await db.chatMessage.findMany({
            where: {
                id: { in: messageIds },
                projectId,
                userId: { not: session.user.id }, // Don't mark own messages
            },
            select: { id: true },
        });

        // Create read receipts for all messages
        await Promise.all(
            messages.map((msg) =>
                db.chatReadReceipt.upsert({
                    where: {
                        messageId_userId: {
                            messageId: msg.id,
                            userId: session.user.id,
                        },
                    },
                    create: {
                        messageId: msg.id,
                        userId: session.user.id,
                    },
                    update: {
                        readAt: new Date(),
                    },
                })
            )
        );

        return Response.json({
            success: true,
            data: {
                markedCount: messages.length,
            },
        });
    } catch (error) {
        return handleApiError(error);
    }
}

// GET /api/projects/[id]/chat/messages/[messageId]/read - Get read receipts for message
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

        // Get read receipts with user info
        const receipts = await db.chatReadReceipt.findMany({
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
            orderBy: { readAt: "asc" },
        });

        return Response.json({
            success: true,
            data: receipts.map((r) => ({
                userId: r.userId,
                userName: r.user.name || "Unknown User",
                userImage: r.user.image,
                readAt: r.readAt,
            })),
        });
    } catch (error) {
        return handleApiError(error);
    }
}

