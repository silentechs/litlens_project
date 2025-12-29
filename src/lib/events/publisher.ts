/**
 * Event Publisher
 *
 * Source of truth:
 * - APIs/DB remain the source of truth.
 * - These events are "invalidation hints" for clients (TanStack Query refetch).
 *
 * Transport:
 * - Redis Pub/Sub (Upstash) when configured.
 * - In-memory EventBus fallback for local/dev without Redis.
 */

import { getRedisPublisher, isRedisConfigured } from "@/lib/redis";

// ============== MESSAGE CONTRACT ==============

export interface SSEMessage {
  type: string;
  data: unknown;
  timestamp: number;
}

// ============== IN-MEMORY FALLBACK BUS ==============

type EventCallback = (event: SSEMessage) => void;

class EventBus {
  private subscribers: Map<string, Set<EventCallback>> = new Map();

  subscribe(channel: string, callback: EventCallback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(callback);

    return () => {
      this.subscribers.get(channel)?.delete(callback);
    };
  }

  publish(channel: string, event: SSEMessage) {
    this.subscribers.get(channel)?.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("Error in event callback:", error);
      }
    });
  }
}

export const eventBus = new EventBus();

function publish(channel: string, message: SSEMessage) {
  // Redis is the desired transport.
  if (isRedisConfigured()) {
    const publisher = getRedisPublisher();
    if (!publisher) return;

    void publisher.publish(channel, JSON.stringify(message)).catch((err) => {
      console.error("[redis] publish error", { channel, err });
    });
    return;
  }

  // Fallback: in-memory bus (single-instance only).
  eventBus.publish(channel, message);
}

// ============== EVENT HELPERS ==============

export function publishImportProgress(
  projectId: string,
  batchId: string,
  data: {
    status: string;
    totalRecords: number;
    processedRecords: number;
    duplicatesFound: number;
    errorsCount: number;
  }
) {
  const status = data.status?.toUpperCase?.() || data.status;
  const type =
    status === "COMPLETED"
      ? "import:completed"
      : status === "FAILED" || status === "ERROR"
        ? "import:error"
        : "import:progress";

  publish(`project:${projectId}`, {
    type,
    data: { batchId, projectId, ...data },
    timestamp: Date.now(),
  });
}

export function publishScreeningConflict(
  projectId: string,
  conflictId: string,
  projectWorkId: string
) {
  publish(`project:${projectId}`, {
    type: "screening:conflict",
    data: { conflictId, projectWorkId, projectId },
    timestamp: Date.now(),
  });
}

export function publishAIAnalysisComplete(
  projectId: string,
  projectWorkId: string
) {
  publish(`project:${projectId}`, {
    type: "ai:analysis:completed",
    data: { projectWorkId, projectId },
    timestamp: Date.now(),
  });
}

export function publishNotification(
  userId: string,
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
  }
) {
  publish(`user:${userId}`, {
    type: "notification:new",
    data: notification,
    timestamp: Date.now(),
  });
}

export function publishProjectUpdate(projectId: string) {
  publish(`project:${projectId}`, {
    type: "project:update",
    data: { projectId },
    timestamp: Date.now(),
  });
}

// ============== PRESENCE & COLLABORATION EVENTS ==============

export function publishPresenceJoin(
  projectId: string,
  user: { id: string; name: string; avatar?: string }
) {
  publish(`project:${projectId}`, {
    type: "presence:join",
    data: { projectId, user },
    timestamp: Date.now(),
  });
}

export function publishPresenceLeave(
  projectId: string,
  userId: string
) {
  publish(`project:${projectId}`, {
    type: "presence:leave",
    data: { projectId, userId },
    timestamp: Date.now(),
  });
}

export function publishTypingIndicator(
  projectId: string,
  user: { id: string; name: string },
  location: string // e.g., "screening", "writing", "chat"
) {
  publish(`project:${projectId}`, {
    type: "presence:typing",
    data: { projectId, user, location },
    timestamp: Date.now(),
  });
}

export function publishChatMessage(
  projectId: string,
  message: {
    id: string;
    userId: string;
    userName: string;
    content: string;
    replyToId?: string;
  }
) {
  publish(`project:${projectId}`, {
    type: "chat:message",
    data: { projectId, ...message },
    timestamp: Date.now(),
  });
}

export function publishScreeningUpdate(
  projectId: string,
  data: {
    projectWorkId: string;
    userId: string;
    decision: string;
    phase: string;
  }
) {
  publish(`project:${projectId}`, {
    type: "screening:update",
    data: { projectId, ...data },
    timestamp: Date.now(),
  });
}

export function publishExtractionUpdate(
  projectId: string,
  projectWorkId: string,
  userId: string
) {
  publish(`project:${projectId}`, {
    type: "extraction:update",
    data: { projectId, projectWorkId, userId },
    timestamp: Date.now(),
  });
}

export function publishChatReaction(
  projectId: string,
  data: {
    messageId: string;
    userId: string;
    userName: string;
    emoji: string;
    action: "add" | "remove";
  }
) {
  publish(`project:${projectId}`, {
    type: "chat:reaction",
    data: { projectId, ...data },
    timestamp: Date.now(),
  });
}

export function publishChatReadReceipt(
  projectId: string,
  data: {
    messageId: string;
    userId: string;
    userName: string;
  }
) {
  publish(`project:${projectId}`, {
    type: "chat:read",
    data: { projectId, ...data },
    timestamp: Date.now(),
  });
}
