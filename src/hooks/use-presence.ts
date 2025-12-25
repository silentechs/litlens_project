"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface PresenceUser {
    id: string;
    name: string;
    avatar?: string;
    lastSeen: number;
}

interface TypingUser {
    id: string;
    name: string;
    location: string;
    timestamp: number;
}

interface UsePresenceOptions {
    projectId: string;
    currentUser: { id: string; name: string; avatar?: string };
}

interface PresenceState {
    activeUsers: PresenceUser[];
    typingUsers: TypingUser[];
}

/**
 * Hook for real-time presence awareness in a project
 * 
 * Tracks who's online and who's typing in different areas
 */
export function usePresence({ projectId, currentUser }: UsePresenceOptions): PresenceState & {
    announcePresence: () => void;
    announceTyping: (location: string) => void;
} {
    const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
    const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Clean up stale typing indicators (older than 3 seconds)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setTypingUsers(prev => prev.filter(u => now - u.timestamp < 3000));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Connect to SSE and listen for presence events
    useEffect(() => {
        const eventSource = new EventSource(`/api/events?projectId=${projectId}`);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                switch (message.type) {
                    case "presence:join":
                        setActiveUsers(prev => {
                            const filtered = prev.filter(u => u.id !== message.data.user.id);
                            return [...filtered, { ...message.data.user, lastSeen: Date.now() }];
                        });
                        break;

                    case "presence:leave":
                        setActiveUsers(prev => prev.filter(u => u.id !== message.data.userId));
                        break;

                    case "presence:typing":
                        if (message.data.user.id !== currentUser.id) {
                            setTypingUsers(prev => {
                                const filtered = prev.filter(u => u.id !== message.data.user.id);
                                return [...filtered, {
                                    ...message.data.user,
                                    location: message.data.location,
                                    timestamp: Date.now(),
                                }];
                            });
                        }
                        break;
                }
            } catch {
                // Ignore parse errors
            }
        };

        // Announce presence on connect
        void fetch(`/api/presence/${projectId}/join`, { method: "POST" });

        return () => {
            eventSource.close();
            // Announce leave on disconnect
            void fetch(`/api/presence/${projectId}/leave`, { method: "POST" });
        };
    }, [projectId, currentUser.id]);

    const announcePresence = useCallback(() => {
        void fetch(`/api/presence/${projectId}/join`, { method: "POST" });
    }, [projectId]);

    const announceTyping = useCallback((location: string) => {
        void fetch(`/api/presence/${projectId}/typing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ location }),
        });
    }, [projectId]);

    return {
        activeUsers,
        typingUsers,
        announcePresence,
        announceTyping,
    };
}

export default usePresence;
