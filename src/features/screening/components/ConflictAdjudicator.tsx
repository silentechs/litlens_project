"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Check,
  X,
  AlertTriangle,
  User,
  ArrowRight,
  MessageSquare,
  History,
  ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useConflicts, useResolveConflict } from "@/features/screening/api/queries";
import { useProject } from "@/features/projects/api/queries";
import type { Conflict as ConflictType } from "@/lib/api-client";
import { toast } from "sonner";

// Local interfaces replaced by api-client types

export function ConflictAdjudicator() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: session } = useSession();
  const { data: project } = useProject(projectId);
  const { data, isLoading, refetch } = useConflicts(projectId, { status: "PENDING" });

  const resolveConflict = useResolveConflict(projectId);
  const conflicts = data?.items || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const activeConflict = (conflicts[currentIndex] as unknown as ConflictType) || undefined;

  const currentUserId = session?.user?.id;
  const currentRole = project?.members?.find((m) => m.userId === currentUserId)?.role;
  const canAdjudicate = currentRole ? ["OWNER", "LEAD"].includes(currentRole) : false;
  const adjudicationDisabled = resolveConflict.isPending || !canAdjudicate;

  const handleResolve = async (decision: 'INCLUDE' | 'EXCLUDE' | 'MAYBE') => {
    if (!activeConflict) return;

    if (!canAdjudicate) {
      toast.error("Only project leads can resolve conflicts");
      return;
    }

    try {
      await resolveConflict.mutateAsync({
        conflictId: activeConflict.id,
        finalDecision: decision,
        reasoning: "Adjudicated via Adjudicator Mode"
      });
      toast.success("Conflict resolved");
      // Move to next or refresh
      if (conflicts.length > 1) {
        setCurrentIndex(prev => (prev + 1) % (conflicts.length - 1));
      }
      refetch();
    } catch (error) {
      console.error("Failed to resolve conflict", error);
      toast.error(error instanceof Error ? error.message : "Failed to resolve conflict");
    }
  };

  if (isLoading) {
    return (
      <div className="py-40 text-center space-y-4">
        <History className="w-12 h-12 mx-auto text-muted animate-spin opacity-20" />
        <p className="font-serif italic text-muted">Retrieving divergent assessments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Conflict Adjudication</h1>
          <p className="text-muted font-serif italic text-xl">Resolving divergent evidence assessments with methodological rigor.</p>
        </div>
        <div className="flex items-center gap-4 bg-white border border-border px-6 py-2 shadow-editorial">
          <ShieldCheck className="w-5 h-5 text-intel-blue" />
          <span className="font-mono text-xs uppercase tracking-widest">Adjudicator Mode Active</span>
        </div>
      </header>

      <div className="accent-line" />

      {activeConflict ? (
        <div className="editorial-grid gap-12">
          {/* Study Overview (Aside) */}
          <aside className="col-span-12 md:col-span-4 space-y-8">
            <div className="bg-white border border-border p-8 space-y-6 sticky top-8">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted border-b border-border pb-4">Study under Review</h3>
              <div className="space-y-4">
                <h4 className="text-3xl font-serif leading-tight">{activeConflict.work?.title || "Untitled Study"}</h4>
                <p className="font-serif italic text-muted text-sm">
                  {activeConflict.work?.authors?.map(a => a.name).join(', ') || "Unknown Authors"} ({activeConflict.work?.year || "N/A"})
                </p>
                <div className="accent-line opacity-5" />
                <p className="text-sm font-serif italic leading-relaxed text-muted line-clamp-[12]">
                  {activeConflict.work?.abstract || "No abstract available for this study."}
                </p>
                <button className="text-[10px] font-mono uppercase tracking-widest text-intel-blue hover:underline">View Full Abstract</button>
              </div>
            </div>
          </aside>

          {/* Adjudication Workspace */}
          <main className="col-span-12 md:col-span-8 space-y-12">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Reviewer Discrepancies</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border overflow-hidden">
              {activeConflict.decisions.map((d, i) => (
                <div key={i} className="bg-white p-8 space-y-8">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-paper border border-border flex items-center justify-center font-bold text-[10px]">
                        {d.reviewerName ? d.reviewerName.split(' ').map(n => n[0]).join('') : "U"}
                      </div>
                      <span className="font-serif font-bold italic">{d.reviewerName || "Unknown Reviewer"}</span>
                    </div>
                    <DecisionBadge decision={d.decision} />
                  </div>

                  <div className="space-y-4">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted">Reasoning</label>
                    <p className="font-serif italic text-lg leading-relaxed">"{d.reasoning || "No reasoning provided."}"</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Adjudication Actions */}
            <div className="bg-ink text-paper p-12 space-y-8 shadow-editorial relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <ShieldCheck className="w-32 h-32" />
              </div>

              <div className="space-y-2">
                <h3 className="text-3xl font-serif">Final Adjudication</h3>
                <p className="text-paper/60 font-serif italic">Your decision will override the current discrepancy and advance the study.</p>
              </div>

              {!canAdjudicate && (
                <div className="border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-rose-200 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-rose-200">
                      Permission required
                    </p>
                    <p className="text-paper/80 font-serif italic text-sm">
                      Only project owners/leads can resolve conflicts. Your role:{" "}
                      <span className="font-serif not-italic font-semibold">{currentRole || "UNKNOWN"}</span>.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
                <FinalAction
                  label="Include"
                  icon={resolveConflict.isPending ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Check className="w-5 h-5" />}
                  color="green"
                  disabled={adjudicationDisabled}
                  title={!canAdjudicate ? "Only project owners/leads can resolve conflicts" : undefined}
                  onClick={() => handleResolve('INCLUDE')}
                />
                <FinalAction
                  label="Exclude"
                  icon={resolveConflict.isPending ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <X className="w-5 h-5" />}
                  color="red"
                  disabled={adjudicationDisabled}
                  title={!canAdjudicate ? "Only project owners/leads can resolve conflicts" : undefined}
                  onClick={() => handleResolve('EXCLUDE')}
                />
                <FinalAction
                  label="Undecided"
                  icon={<MessageSquare className="w-5 h-5" />}
                  color="muted"
                  disabled={adjudicationDisabled}
                  title={!canAdjudicate ? "Only project owners/leads can resolve conflicts" : undefined}
                  onClick={() => handleResolve('MAYBE')}
                />
              </div>

              <div className="pt-8 flex justify-between items-center border-t border-white/10">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-paper/40">
                  <AlertTriangle className="w-3 h-3" />
                  Decision will be logged in the permanent audit trail
                </div>
                <button
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % conflicts.length)}
                  className="text-paper/60 hover:text-paper font-serif italic text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                  disabled={conflicts.length <= 1}
                >
                  Next Conflict <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </main>
        </div>
      ) : (
        <div className="py-40 text-center space-y-4">
          <Check className="w-12 h-12 mx-auto text-muted opacity-20" />
          <h2 className="text-3xl font-serif italic text-muted">All conflicts have been adjudicated.</h2>
          <button className="btn-editorial" onClick={() => window.history.back()}>Return to Project Overview</button>
        </div>
      )}
    </div>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const colors = {
    INCLUDE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    EXCLUDE: "bg-rose-50 text-rose-700 border-rose-200",
    MAYBE: "bg-amber-50 text-amber-700 border-amber-200"
  };
  return (
    <span className={cn(
      "px-3 py-1 border text-[10px] font-mono uppercase tracking-widest rounded-full",
      colors[decision as keyof typeof colors]
    )}>
      {decision}
    </span>
  );
}

function FinalAction({
  label,
  icon,
  color,
  onClick,
  disabled,
  title,
}: {
  label: string;
  icon: React.ReactNode;
  color: "green" | "red" | "muted";
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const hoverColors = {
    green: "hover:bg-emerald-500 hover:text-white border-emerald-500/30",
    red: "hover:bg-rose-500 hover:text-white border-rose-500/30",
    muted: "hover:bg-paper hover:text-ink border-white/20"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex flex-col items-center justify-center p-8 border transition-all gap-4 bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed",
        !disabled && hoverColors[color]
      )}
    >
      <div className="w-10 h-10 border border-current flex items-center justify-center">
        {icon}
      </div>
      <span className="font-serif italic text-xl tracking-tight">{label}</span>
    </button>
  );
}

