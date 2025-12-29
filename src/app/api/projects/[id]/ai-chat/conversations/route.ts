import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, NotFoundError, success } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";
import { 
  createConversation, 
  listConversations,
  updateConversationTitle,
  toggleArchiveConversation,
  togglePinConversation,
  deleteConversation,
} from "@/lib/services/ai-conversation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Validation schemas
const createConversationSchema = z.object({
  title: z.string().optional(),
});

const updateConversationSchema = z.object({
  title: z.string().optional(),
  isArchived: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

/**
 * GET /api/projects/[id]/ai-chat/conversations
 * List all conversations for a project
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    // Verify project membership
    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: session.user.id } },
    });
    if (!membership) throw new NotFoundError("Project");

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const conversations = await listConversations(projectId, session.user.id, {
      limit,
      includeArchived,
    });

    return success({ conversations });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/projects/[id]/ai-chat/conversations
 * Create a new conversation
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    
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
    const { title } = createConversationSchema.parse(body);

    const conversation = await createConversation(projectId, session.user.id, title);

    return success({ conversation }, undefined, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

