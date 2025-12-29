import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, NotFoundError } from "@/lib/api";
import { db } from "@/lib/db";
import { publishChatMessage } from "@/lib/events/publisher";
import { z } from "zod";

interface RouteParams {
    params: Promise<{ id: string }>;
}

const sendMessageSchema = z.object({
    content: z.string().min(1).max(5000),
    replyToId: z.string().optional(),
    attachmentKeys: z.array(z.string()).optional(),
});

// GET /api/projects/[id]/chat/messages - Retrieve chat messages
export async function GET(request: NextRequest, { params }: RouteParams) {
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

        // Get pagination params
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const cursor = url.searchParams.get("cursor");

        // Fetch messages with all related data
        const messages = await db.chatMessage.findMany({
            where: { 
                projectId,
                isDeleted: false, // Don't return deleted messages
            },
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
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                attachments: true,
                reactions: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                            },
                        },
                    },
                },
                readReceipts: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        // Check if there are more messages
        const hasMore = messages.length > limit;
        const data = hasMore ? messages.slice(0, -1) : messages;

        // Transform to match component interface
        const transformedMessages = data.reverse().map((msg) => {
            // Group reactions by emoji
            const reactions = msg.reactions.reduce((acc, reaction) => {
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

            return {
                id: msg.id,
                userId: msg.userId,
                userName: msg.user.name || "Unknown User",
                content: msg.content,
                createdAt: msg.createdAt,
                replyToId: msg.replyToId,
                replyToContent: msg.replyTo?.content,
                replyToUserName: msg.replyTo?.user.name,
                isDeleted: msg.isDeleted,
                editedAt: msg.editedAt,
                attachments: msg.attachments.map(att => ({
                    id: att.id,
                    fileName: att.fileName,
                    fileSize: att.fileSize,
                    mimeType: att.mimeType,
                    url: att.url,
                })),
                reactions: Object.keys(reactions).length > 0 ? reactions : undefined,
                readReceipts: msg.readReceipts.map(r => ({
                    userId: r.userId,
                    userName: r.user.name || "Unknown User",
                    userImage: r.user.image,
                    readAt: r.readAt,
                })),
            };
        });

        return Response.json({
            success: true,
            data: transformedMessages,
            pagination: {
                hasMore,
                nextCursor: hasMore ? messages[messages.length - 1].id : null,
            },
        });
    } catch (error) {
        return handleApiError(error);
    }
}

// POST /api/projects/[id]/chat/messages - Send a chat message
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        console.log('[Chat] POST /api/projects/[id]/chat/messages - Start');
        
        const session = await auth();
        console.log('[Chat] Session:', session?.user?.id);
        
        if (!session?.user?.id) {
            console.log('[Chat] No session, throwing UnauthorizedError');
            throw new UnauthorizedError();
        }

        const { id: projectId } = await params;
        console.log('[Chat] Project ID:', projectId);

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
        console.log('[Chat] Request body:', body);
        
        const { content, replyToId, attachmentKeys } = sendMessageSchema.parse(body);
        console.log('[Chat] Parsed - content:', content, 'replyToId:', replyToId);

        // Validate replyTo message exists if provided
        if (replyToId) {
            const replyToMessage = await db.chatMessage.findUnique({
                where: { id: replyToId },
            });

            if (!replyToMessage || replyToMessage.projectId !== projectId) {
                console.log('[Chat] Reply message not found or wrong project');
                throw new NotFoundError("Reply message");
            }
        }

        console.log('[Chat] Creating message in database...');
        
        // Create the message (without attachments for now - they'll be added separately)
        const message = await db.chatMessage.create({
            data: {
                projectId,
                userId: session.user.id,
                content,
                replyToId,
            },
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
                        content: true,
                    },
                },
            },
        });
        
        console.log('[Chat] Message created:', message.id);

        // Broadcast the message via SSE
        console.log('[Chat] Broadcasting message via SSE...');
        publishChatMessage(projectId, {
            id: message.id,
            userId: message.userId,
            userName: message.user.name || "Unknown User",
            content: message.content,
            replyToId: message.replyToId || undefined,
        });

        const response = {
            success: true,
            data: {
                id: message.id,
                userId: message.userId,
                userName: message.user.name || "Unknown User",
                content: message.content,
                createdAt: message.createdAt,
                replyToId: message.replyToId,
                replyToContent: message.replyTo?.content,
            },
        };
        
        console.log('[Chat] Sending response:', response);
        return Response.json(response);
    } catch (error) {
        console.error('[Chat] Error:', error);
        return handleApiError(error);
    }
}

