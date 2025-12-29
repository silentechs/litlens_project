import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, NotFoundError, ForbiddenError } from "@/lib/api";
import { db } from "@/lib/db";
import { publishChatMessage } from "@/lib/events/publisher";
import { z } from "zod";

interface RouteParams {
    params: Promise<{ id: string; messageId: string }>;
}

const editMessageSchema = z.object({
    content: z.string().min(1).max(5000),
});

// PATCH /api/projects/[id]/chat/messages/[messageId] - Edit message
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

        // Find the message
        const existingMessage = await db.chatMessage.findUnique({
            where: { id: messageId },
        });

        if (!existingMessage) {
            throw new NotFoundError("Message");
        }

        // Only message author can edit
        if (existingMessage.userId !== session.user.id) {
            throw new ForbiddenError("You can only edit your own messages");
        }

        // Cannot edit deleted messages
        if (existingMessage.isDeleted) {
            throw new ForbiddenError("Cannot edit deleted messages");
        }

        const body = await request.json();
        const { content } = editMessageSchema.parse(body);

        // Update the message
        const updatedMessage = await db.chatMessage.update({
            where: { id: messageId },
            data: {
                content,
                editedAt: new Date(),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Broadcast update via SSE
        publishChatMessage(projectId, {
            id: updatedMessage.id,
            userId: updatedMessage.userId,
            userName: updatedMessage.user.name || "Unknown User",
            content: updatedMessage.content,
            replyToId: updatedMessage.replyToId || undefined,
        });

        return Response.json({
            success: true,
            data: {
                id: updatedMessage.id,
                content: updatedMessage.content,
                editedAt: updatedMessage.editedAt,
            },
        });
    } catch (error) {
        return handleApiError(error);
    }
}

// DELETE /api/projects/[id]/chat/messages/[messageId] - Delete message
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

        // Find the message
        const existingMessage = await db.chatMessage.findUnique({
            where: { id: messageId },
        });

        if (!existingMessage) {
            throw new NotFoundError("Message");
        }

        // Only message author or project LEAD can delete
        const canDelete =
            existingMessage.userId === session.user.id ||
            membership.role === "LEAD";

        if (!canDelete) {
            throw new ForbiddenError("You can only delete your own messages");
        }

        // Soft delete (mark as deleted)
        await db.chatMessage.update({
            where: { id: messageId },
            data: {
                isDeleted: true,
                content: "[Message deleted]",
            },
        });

        // Broadcast deletion via SSE
        publishChatMessage(projectId, {
            id: existingMessage.id,
            userId: existingMessage.userId,
            userName: "[Deleted]",
            content: "[Message deleted]",
            replyToId: existingMessage.replyToId || undefined,
        });

        return Response.json({
            success: true,
            message: "Message deleted",
        });
    } catch (error) {
        return handleApiError(error);
    }
}

