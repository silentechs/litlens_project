"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/api/queries';
import { screeningKeys } from '@/features/screening/api/queries';
import { libraryKeys } from '@/features/library/api/queries';

// ============== TYPES ==============

interface SSEMessage {
  type: SSEEventType;
  data: unknown;
  timestamp: number;
}

type SSEEventType =
  | "connection"
  | "heartbeat"
  | "import:progress"
  | "import:completed"
  | "import:error"
  | "screening:conflict"
  | "screening:progress"
  | "ai:analysis:started"
  | "ai:analysis:progress"
  | "ai:analysis:completed"
  | "project:update"
  | "notification:new"
  | "export:progress"
  | "export:completed";

interface ImportProgressData {
  batchId: string;
  projectId: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  duplicatesFound: number;
  errorsCount: number;
}

interface ConflictData {
  conflictId: string;
  projectWorkId: string;
  projectId: string;
}

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
}

// ============== CONNECTION STATE ==============

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

// ============== MAIN HOOK ==============

export function useSSE(projectId?: string) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [lastEvent, setLastEvent] = useState<SSEMessage | null>(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_MS = 3000;

  // Event handlers
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: SSEMessage = JSON.parse(event.data);
      setLastEvent(message);
      
      switch (message.type) {
        case "connection":
          setConnectionState("connected");
          reconnectAttemptsRef.current = 0;
          break;

        case "heartbeat":
          // Connection is healthy
          break;

        case "import:progress": {
          const data = message.data as ImportProgressData;
          queryClient.setQueryData(
            ["import-progress", data.projectId, data.batchId], 
            data
          );
          break;
        }

        case "import:completed": {
          const data = message.data as ImportProgressData;
          // Invalidate project stats and screening queue
          queryClient.invalidateQueries({ 
            queryKey: projectKeys.stats(data.projectId) 
          });
          queryClient.invalidateQueries({ 
            queryKey: screeningKeys.queues() 
          });
          break;
        }

        case "screening:conflict": {
          const data = message.data as ConflictData;
          // Invalidate conflicts list
          queryClient.invalidateQueries({ 
            queryKey: screeningKeys.conflicts(data.projectId) 
          });
          // Invalidate project stats
          queryClient.invalidateQueries({ 
            queryKey: projectKeys.stats(data.projectId) 
          });
          break;
        }

        case "ai:analysis:completed": {
          const data = message.data as { projectWorkId: string; projectId: string };
          // Invalidate screening queue to show AI suggestions
          queryClient.invalidateQueries({ 
            queryKey: screeningKeys.queues() 
          });
          break;
        }

        case "project:update": {
          const data = message.data as { projectId: string };
          queryClient.invalidateQueries({ 
            queryKey: projectKeys.detail(data.projectId) 
          });
          queryClient.invalidateQueries({ 
            queryKey: projectKeys.stats(data.projectId) 
          });
          break;
        }

        case "notification:new": {
          const data = message.data as NotificationData;
          // Could trigger a toast notification here
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          break;
        }
      }
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  }, [queryClient]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionState("connecting");

    const url = projectId 
      ? `/api/events?projectId=${projectId}` 
      : '/api/events';
    
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = handleMessage;

    eventSource.onerror = () => {
      setConnectionState("error");
      eventSource.close();

      // Attempt to reconnect
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        console.log(`SSE reconnecting... attempt ${reconnectAttemptsRef.current}`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY_MS * reconnectAttemptsRef.current);
      } else {
        console.error('SSE max reconnect attempts reached');
        setConnectionState("disconnected");
      }
    };

    eventSource.onopen = () => {
      setConnectionState("connected");
      reconnectAttemptsRef.current = 0;
    };
  }, [projectId, handleMessage]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  return {
    connectionState,
    lastEvent,
    reconnect,
  };
}

// ============== IMPORT PROGRESS HOOK ==============

interface ImportProgress {
  status: string;
  totalRecords: number;
  processedRecords: number;
  duplicatesFound: number;
  errorsCount: number;
  percentage: number;
}

export function useImportProgress(projectId: string, batchId: string) {
  const queryClient = useQueryClient();
  
  const data = queryClient.getQueryData<ImportProgressData>(
    ["import-progress", projectId, batchId]
  );

  if (!data) {
    return null;
  }

  const progress: ImportProgress = {
    ...data,
    percentage: data.totalRecords > 0 
      ? Math.round((data.processedRecords / data.totalRecords) * 100) 
      : 0,
  };

  return progress;
}

// ============== NOTIFICATION SSE HOOK ==============

export function useNotificationSSE(onNotification?: (notification: NotificationData) => void) {
  const { lastEvent } = useSSE();

  useEffect(() => {
    if (lastEvent?.type === "notification:new" && onNotification) {
      onNotification(lastEvent.data as NotificationData);
    }
  }, [lastEvent, onNotification]);
}
