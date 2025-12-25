import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
    handleApiError,
    UnauthorizedError,
    NotFoundError,
    success,
    created,
} from "@/lib/api";
import { publishChatMessage } from "@/lib/events/publisher";
import { z } from "zod";

interface RouteParams {
    params: Promise<{ id: string }>;
}

const messageSchema = z.object({
    content: z.string().min(1).max(2000),
    replyToId: z.string().optional(),
});

// GET /api/projects/[id]/chat - Get chat messages
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId } = await params;

        // Verify membership
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

        // Get recent messages
        const messages = await db.chatMessage.findMany({
            where: { projectId },
            orderBy: { createdAt: "asc" },
            take: 100,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
                replyTo: {
                    select: {
                        id: true,
                        content: true,
                        user: {
                            select: { name: true },
                        },
                    },
                },
            },
        });

        return success(messages.map(msg => ({
            id: msg.id,
            userId: msg.userId,
            userName: msg.user.name,
            content: msg.content,
            createdAt: msg.createdAt,
            replyToId: msg.replyToId,
            replyToContent: msg.replyTo?.content,
        })));
    } catch (error) {
        return handleApiError(error);
    }
}

// POST /api/projects/[id]/chat - Send a message
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId } = await params;

        // Verify membership
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
        const { content, replyToId } = messageSchema.parse(body);

        // Create message
        const message = await db.chatMessage.create({
            data: {
                projectId,
                userId: session.user.id,
                content,
                replyToId,
            },
            include: {
                user: {
                    select: { name: true },
                },
            },
        });

        // Broadcast to project members
        publishChatMessage(projectId, {
            id: message.id,
            userId: session.user.id,
            userName: message.user.name || "Anonymous",
            content: message.content,
            replyToId: message.replyToId || undefined,
        });

        return created({
            id: message.id,
            content: message.content,
            createdAt: message.createdAt,
        });
    } catch (error) {
        return handleApiError(error);
    }
}
