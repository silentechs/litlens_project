/**
 * AI Conversation Service
 * Handles persistence and management of AI chat conversations
 */

import { db } from "@/lib/db";
import type { 
  Conversation, 
  ChatMessage, 
  Citation,
  EvidenceQuality,
  FeedbackType,
  MessageRole 
} from "@/domain/chat/types";

// ============== CONVERSATION CRUD ==============

/**
 * Create a new conversation
 */
export async function createConversation(
  projectId: string,
  userId: string,
  title?: string
): Promise<Conversation> {
  const conversation = await db.aIConversation.create({
    data: {
      projectId,
      userId,
      title: title || "New conversation",
    },
  });

  return mapConversation(conversation);
}

/**
 * Get conversation by ID
 */
export async function getConversation(
  conversationId: string,
  userId: string
): Promise<Conversation | null> {
  const conversation = await db.aIConversation.findFirst({
    where: {
      id: conversationId,
      userId, // Ensure user owns conversation
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) return null;

  return mapConversation(conversation);
}

/**
 * List conversations for a project
 */
export async function listConversations(
  projectId: string,
  userId: string,
  options: {
    limit?: number;
    includeArchived?: boolean;
  } = {}
): Promise<Conversation[]> {
  const { limit = 50, includeArchived = false } = options;

  const conversations = await db.aIConversation.findMany({
    where: {
      projectId,
      userId,
      ...(includeArchived ? {} : { isArchived: false }),
    },
    orderBy: [
      { isPinned: "desc" },
      { updatedAt: "desc" },
    ],
    take: limit,
  });

  return conversations.map(mapConversation);
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
  conversationId: string,
  userId: string,
  title: string
): Promise<Conversation | null> {
  const conversation = await db.aIConversation.updateMany({
    where: {
      id: conversationId,
      userId,
    },
    data: { title },
  });

  if (conversation.count === 0) return null;

  return getConversation(conversationId, userId);
}

/**
 * Archive/unarchive conversation
 */
export async function toggleArchiveConversation(
  conversationId: string,
  userId: string,
  isArchived: boolean
): Promise<boolean> {
  const result = await db.aIConversation.updateMany({
    where: {
      id: conversationId,
      userId,
    },
    data: { isArchived },
  });

  return result.count > 0;
}

/**
 * Pin/unpin conversation
 */
export async function togglePinConversation(
  conversationId: string,
  userId: string,
  isPinned: boolean
): Promise<boolean> {
  const result = await db.aIConversation.updateMany({
    where: {
      id: conversationId,
      userId,
    },
    data: { isPinned },
  });

  return result.count > 0;
}

/**
 * Delete conversation
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const result = await db.aIConversation.deleteMany({
    where: {
      id: conversationId,
      userId,
    },
  });

  return result.count > 0;
}

// ============== MESSAGE CRUD ==============

/**
 * Add a message to conversation
 */
export async function addMessage(
  conversationId: string,
  data: {
    role: MessageRole;
    content: string;
    citations?: Citation[];
    confidence?: number;
    evidenceQuality?: EvidenceQuality;
    sourceCount?: number;
    retrievalScores?: number[];
    suggestedQuestions?: string[];
    modelUsed?: string;
    tokenCount?: number;
    processingTimeMs?: number;
  }
): Promise<ChatMessage> {
  const message = await db.aIMessage.create({
    data: {
      conversationId,
      role: data.role.toUpperCase() as "USER" | "ASSISTANT" | "SYSTEM",
      content: data.content,
      citations: data.citations ? JSON.parse(JSON.stringify(data.citations)) : undefined,
      confidence: data.confidence,
      evidenceQuality: mapEvidenceQualityToEnum(data.evidenceQuality),
      sourceCount: data.sourceCount,
      retrievalScores: data.retrievalScores ? JSON.parse(JSON.stringify(data.retrievalScores)) : undefined,
      suggestedQuestions: data.suggestedQuestions ? JSON.parse(JSON.stringify(data.suggestedQuestions)) : undefined,
      modelUsed: data.modelUsed,
      tokenCount: data.tokenCount,
      processingTimeMs: data.processingTimeMs,
    },
  });

  // Update conversation metadata
  await db.aIConversation.update({
    where: { id: conversationId },
    data: {
      messageCount: { increment: 1 },
      lastMessageAt: new Date(),
    },
  });

  return mapMessage(message);
}

/**
 * Get messages for a conversation
 */
export async function getMessages(
  conversationId: string,
  options: {
    limit?: number;
    before?: string; // cursor for pagination
  } = {}
): Promise<ChatMessage[]> {
  const { limit = 100, before } = options;

  const messages = await db.aIMessage.findMany({
    where: {
      conversationId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return messages.map(mapMessage);
}

/**
 * Add feedback to a message
 */
export async function addMessageFeedback(
  messageId: string,
  data: {
    score: number;
    type?: FeedbackType;
    comment?: string;
  }
): Promise<boolean> {
  const result = await db.aIMessage.update({
    where: { id: messageId },
    data: {
      feedbackScore: data.score,
      feedbackType: data.type ? mapFeedbackTypeToEnum(data.type) : null,
      feedbackComment: data.comment,
    },
  });

  return !!result;
}

/**
 * Flag a message
 */
export async function flagMessage(
  messageId: string,
  reason: string
): Promise<boolean> {
  const result = await db.aIMessage.update({
    where: { id: messageId },
    data: {
      flagged: true,
      flagReason: reason,
    },
  });

  return !!result;
}

/**
 * Generate conversation title from first message
 */
export async function generateConversationTitle(
  conversationId: string,
  firstMessage: string
): Promise<string> {
  // Simple title generation: truncate first message
  const title = firstMessage.length > 50 
    ? firstMessage.substring(0, 47) + "..."
    : firstMessage;

  await db.aIConversation.update({
    where: { id: conversationId },
    data: { title },
  });

  return title;
}

// ============== MAPPERS ==============

function mapConversation(conv: {
  id: string;
  projectId: string;
  userId: string;
  title: string | null;
  summary: string | null;
  messageCount: number;
  lastMessageAt: Date | null;
  isArchived: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  messages?: unknown[];
}): Conversation {
  return {
    id: conv.id,
    projectId: conv.projectId,
    userId: conv.userId,
    title: conv.title || undefined,
    summary: conv.summary || undefined,
    messageCount: conv.messageCount,
    lastMessageAt: conv.lastMessageAt || undefined,
    isArchived: conv.isArchived,
    isPinned: conv.isPinned,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messages: conv.messages?.map((m) => mapMessage(m as Parameters<typeof mapMessage>[0])),
  };
}

function mapMessage(msg: {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  citations: unknown;
  confidence: number | null;
  evidenceQuality: string | null;
  sourceCount: number | null;
  suggestedQuestions: unknown;
  feedbackScore: number | null;
  feedbackType: string | null;
  flagged: boolean;
  modelUsed: string | null;
  processingTimeMs: number | null;
  createdAt: Date;
}): ChatMessage {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    role: msg.role.toLowerCase() as MessageRole,
    content: msg.content,
    createdAt: msg.createdAt,
    citations: msg.citations ? (typeof msg.citations === 'string' ? JSON.parse(msg.citations) : msg.citations) as Citation[] : undefined,
    confidence: msg.confidence || undefined,
    evidenceQuality: mapEnumToEvidenceQuality(msg.evidenceQuality),
    sourceCount: msg.sourceCount || undefined,
    suggestedQuestions: msg.suggestedQuestions 
      ? (typeof msg.suggestedQuestions === 'string' ? JSON.parse(msg.suggestedQuestions) : msg.suggestedQuestions) as string[]
      : undefined,
    feedbackScore: msg.feedbackScore || undefined,
    feedbackType: mapEnumToFeedbackType(msg.feedbackType),
    flagged: msg.flagged,
    modelUsed: msg.modelUsed || undefined,
    processingTimeMs: msg.processingTimeMs || undefined,
  };
}

function mapEvidenceQualityToEnum(quality?: EvidenceQuality): "STRONG" | "MODERATE" | "WEAK" | "NONE" | null {
  if (!quality) return null;
  return quality.toUpperCase() as "STRONG" | "MODERATE" | "WEAK" | "NONE";
}

function mapEnumToEvidenceQuality(enumVal: string | null): EvidenceQuality | undefined {
  if (!enumVal) return undefined;
  return enumVal.toLowerCase() as EvidenceQuality;
}

function mapFeedbackTypeToEnum(type: FeedbackType): "HELPFUL" | "ACCURATE" | "INCOMPLETE" | "HALLUCINATION" | "WRONG_CITATION" | "OFF_TOPIC" | "OTHER" {
  return type.toUpperCase() as "HELPFUL" | "ACCURATE" | "INCOMPLETE" | "HALLUCINATION" | "WRONG_CITATION" | "OFF_TOPIC" | "OTHER";
}

function mapEnumToFeedbackType(enumVal: string | null): FeedbackType | undefined {
  if (!enumVal) return undefined;
  return enumVal.toLowerCase() as FeedbackType;
}

