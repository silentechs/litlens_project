/**
 * Event Publisher
 * Publish events to SSE subscribers
 */

// ============== EVENT BUS ==============

type EventCallback = (event: SSEEvent) => void;

interface SSEEvent {
  type: string;
  data: unknown;
  userId?: string;
  projectId?: string;
}

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

  publish(channel: string, event: SSEEvent) {
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
  eventBus.publish(`project:${projectId}`, {
    type: "import:progress",
    data: { batchId, projectId, ...data },
    projectId,
  });
}

export function publishScreeningConflict(
  projectId: string,
  conflictId: string,
  projectWorkId: string
) {
  eventBus.publish(`project:${projectId}`, {
    type: "screening:conflict",
    data: { conflictId, projectWorkId, projectId },
    projectId,
  });
}

export function publishAIAnalysisComplete(
  projectId: string,
  projectWorkId: string
) {
  eventBus.publish(`project:${projectId}`, {
    type: "ai:analysis:complete",
    data: { projectWorkId, projectId },
    projectId,
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
  eventBus.publish(`user:${userId}`, {
    type: "notification:new",
    data: notification,
    userId,
  });
}

export function publishProjectUpdate(projectId: string) {
  eventBus.publish(`project:${projectId}`, {
    type: "project:update",
    data: { projectId },
    projectId,
  });
}

