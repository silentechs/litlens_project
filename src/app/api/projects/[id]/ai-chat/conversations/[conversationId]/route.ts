import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, NotFoundError, success } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";
import { 
  getConversation,
  updateConversationTitle,
  toggleArchiveConversation,
  togglePinConversation,
  deleteConversation,
} from "@/lib/services/ai-conversation";

interface RouteParams {
  params: Promise<{ id: string; conversationId: string }>;
}

const updateConversationSchema = z.object({
  title: z.string().optional(),
  isArchived: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

/**
 * GET /api/projects/[id]/ai-chat/conversations/[conversationId]
 * Get a conversation with messages
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, conversationId } = await params;
    
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    // Verify project membership
    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: session.user.id } },
    });
    if (!membership) throw new NotFoundError("Project");

    const conversation = await getConversation(conversationId, session.user.id);
    if (!conversation) throw new NotFoundError("Conversation");

    return success({ conversation });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/projects/[id]/ai-chat/conversations/[conversationId]
 * Update conversation (title, archive, pin)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, conversationId } = await params;
    
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    // Verify project membership
    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: session.user.id } },
    });
    if (!membership) throw new NotFoundError("Project");

    const body = await req.json();
    const { title, isArchived, isPinned } = updateConversationSchema.parse(body);

    // Apply updates
    if (title !== undefined) {
      await updateConversationTitle(conversationId, session.user.id, title);
    }
    if (isArchived !== undefined) {
      await toggleArchiveConversation(conversationId, session.user.id, isArchived);
    }
    if (isPinned !== undefined) {
      await togglePinConversation(conversationId, session.user.id, isPinned);
    }

    const conversation = await getConversation(conversationId, session.user.id);
    if (!conversation) throw new NotFoundError("Conversation");

    return success({ conversation });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/projects/[id]/ai-chat/conversations/[conversationId]
 * Delete a conversation
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, conversationId } = await params;
    
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    // Verify project membership
    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: session.user.id } },
    });
    if (!membership) throw new NotFoundError("Project");

    const deleted = await deleteConversation(conversationId, session.user.id);
    if (!deleted) throw new NotFoundError("Conversation");

    return success({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

