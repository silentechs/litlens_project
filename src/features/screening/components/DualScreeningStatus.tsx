"use client";

import { Users, Clock, CheckCircle2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface DualScreeningStatusProps {
  reviewerStatus: "FIRST_REVIEWER" | "SECOND_REVIEWER" | "AWAITING_OTHER" | "COMPLETED";
  votedReviewers?: Array<{
    id: string;
    name: string | null;
    image: string | null;
    votedAt: string;
  }>;
  totalReviewersNeeded?: number;
  reviewersVoted?: number;
  className?: string;
}

export function DualScreeningStatus({
  reviewerStatus,
  votedReviewers = [],
  totalReviewersNeeded = 2,
  reviewersVoted = 0,
  className,
}: DualScreeningStatusProps) {
  const statusConfig = {
    FIRST_REVIEWER: {
      icon: User,
      label: "You are reviewer #1",
      description: `Awaiting ${totalReviewersNeeded - 1} more ${totalReviewersNeeded - 1 === 1 ? "reviewer" : "reviewers"}`,
      color: "bg-blue-50 text-blue-700 border-blue-200",
      iconColor: "text-blue-500",
    },
    SECOND_REVIEWER: {
      icon: Users,
      label: `You are reviewer #${reviewersVoted + 1}`,
      description: `${reviewersVoted} ${reviewersVoted === 1 ? "reviewer has" : "reviewers have"} already voted`,
      color: "bg-purple-50 text-purple-700 border-purple-200",
      iconColor: "text-purple-500",
    },
    AWAITING_OTHER: {
      icon: Clock,
      label: "Awaiting other reviewers",
      description: `${reviewersVoted}/${totalReviewersNeeded} reviewers have voted`,
      color: "bg-amber-50 text-amber-700 border-amber-200",
      iconColor: "text-amber-500",
    },
    COMPLETED: {
      icon: CheckCircle2,
      label: "Screening complete",
      description: `All ${totalReviewersNeeded} reviewers have voted`,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      iconColor: "text-emerald-500",
    },
  };

  const config = statusConfig[reviewerStatus];
  const Icon = config.icon;

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 border rounded-sm",
          config.color
        )}
      >
        <Icon className={cn("w-4 h-4", config.iconColor)} />
        <div className="flex-1">
          <div className="font-mono text-[10px] uppercase tracking-widest font-bold">
            {config.label}
          </div>
          <div className="font-serif italic text-xs mt-0.5">
            {config.description}
          </div>
        </div>
      </div>

      {/* Show voted reviewers if available */}
      {votedReviewers.length > 0 && (
        <div className="flex items-center gap-2 px-4">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted">
            Voted:
          </span>
          <div className="flex -space-x-2">
            {votedReviewers.map((reviewer) => (
              <div
                key={reviewer.id}
                className="w-6 h-6 rounded-full bg-white border-2 border-paper flex items-center justify-center font-bold text-[9px] text-ink"
                title={`${reviewer.name || "Unknown"} - Voted ${new Date(
                  reviewer.votedAt
                ).toLocaleString()}`}
              >
                {reviewer.name
                  ? reviewer.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                  : "?"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

