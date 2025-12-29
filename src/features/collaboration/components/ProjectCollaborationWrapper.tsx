"use client";

import { useState } from "react";
import { MessageSquare, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnhancedProjectChat } from "@/components/collaboration/EnhancedProjectChat";
import { PresenceIndicator } from "@/components/collaboration/PresenceIndicator";
import { usePresence } from "@/hooks/use-presence";
import { useSession } from "next-auth/react";

interface ProjectCollaborationWrapperProps {
  projectId: string;
  children: React.ReactNode;
}

/**
 * Wraps project pages with collaboration features:
 * - Real-time presence indicators
 * - Floating chat panel
 */
export function ProjectCollaborationWrapper({
  projectId,
  children,
}: ProjectCollaborationWrapperProps) {
  const { data: session } = useSession();
  const [isChatOpen, setIsChatOpen] = useState(false);

  const currentUser = session?.user
    ? {
        id: session.user.id!,
        name: session.user.name || "Unknown User",
        avatar: session.user.image || undefined,
      }
    : null;

  const { activeUsers, typingUsers } = usePresence({
    projectId,
    currentUser: currentUser || { id: "guest", name: "Guest" },
  });

  if (!currentUser) {
    return <>{children}</>;
  }

  // Always include current user in the active users list if not already there
  const allActiveUsers = activeUsers.some(u => u.id === currentUser.id)
    ? activeUsers
    : [...activeUsers, { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar, lastSeen: Date.now() }];

  return (
    <div className="relative">
      {/* Presence Indicator - Top Right */}
      <div className="fixed top-20 right-6 z-[90] bg-white border border-border rounded-lg px-4 py-2 shadow-sm">
        <PresenceIndicator users={allActiveUsers} size="sm" />
      </div>

      {/* Main Content */}
      {children}

      {/* Chat Toggle Button - Bottom Right */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-[120] rounded-full p-4 shadow-lg transition-all",
          "hover:scale-110 active:scale-95",
          isChatOpen
            ? "bg-ink text-paper"
            : "bg-white border-2 border-ink text-ink hover:bg-ink hover:text-paper"
        )}
        aria-label={isChatOpen ? "Close chat" : "Open chat"}
      >
        {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {/* Overlay when chat is open */}
      {isChatOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[100]"
          onClick={() => setIsChatOpen(false)}
        />
      )}

      {/* Chat Panel - Slide from Right */}
      <div
        className={cn(
          "fixed top-0 right-0 h-screen w-96 bg-white shadow-2xl z-[110] transition-transform duration-300",
          isChatOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <EnhancedProjectChat projectId={projectId} currentUser={currentUser} className="h-full" />
      </div>
    </div>
  );
}

