import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, NotFoundError, success } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";
import { addMessageFeedback, flagMessage } from "@/lib/services/ai-conversation";

interface RouteParams {
  params: Promise<{ id: string; messageId: string }>;
}

const feedbackSchema = z.object({
  score: z.number().min(1).max(5),
  type: z.enum([
    "helpful",
    "accurate", 
    "incomplete",
    "hallucination",
    "wrong_citation",
    "off_topic",
    "other",
  ]).optional(),
  comment: z.string().max(1000).optional(),
});

const flagSchema = z.object({
  reason: z.string().min(1).max(500),
});

/**
 * POST /api/projects/[id]/ai-chat/messages/[messageId]/feedback
 * Add feedback (thumbs up/down) to a message
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, messageId } = await params;
    
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
    
    // Check if this is a flag request or feedback request
    if (body.reason !== undefined) {
      const { reason } = flagSchema.parse(body);
      const flagged = await flagMessage(messageId, reason);
      if (!flagged) throw new NotFoundError("Message");
      return success({ flagged: true });
    }

    const { score, type, comment } = feedbackSchema.parse(body);
    
    const updated = await addMessageFeedback(messageId, {
      score,
      type: type as Parameters<typeof addMessageFeedback>[1]["type"],
      comment,
    });
    
    if (!updated) throw new NotFoundError("Message");

    return success({ updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}

