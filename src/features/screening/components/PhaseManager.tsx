"use client";

import { useState } from "react";
import { useScreeningNextSteps, useAdvancePhase } from "@/features/screening/api/queries";
import { useScreeningStore } from "@/stores/screening-store";
import { Loader2, ArrowRight, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PhaseManagerProps {
    projectId: string;
}

export function PhaseManager({ projectId }: PhaseManagerProps) {
    const { currentPhase } = useScreeningStore();
    const { data: nextSteps, isLoading, refetch } = useScreeningNextSteps(projectId, currentPhase);
    const advancePhase = useAdvancePhase(projectId);
    const [showConfirm, setShowConfirm] = useState(false);

    if (isLoading || !nextSteps) return null;

    const progress = nextSteps.phaseStats.total > 0
        ? Math.round(((nextSteps.phaseStats.total - nextSteps.totalPending) / nextSteps.phaseStats.total) * 100)
        : 0;

    const handleMovePhase = async () => {
        if (!nextSteps.nextPhase) return;

        try {
            await advancePhase.mutateAsync({
                currentPhase
            });
            setShowConfirm(false);
            refetch();
        } catch (error) {
            console.error("Failed to move phase", error);
        }
    };

    return (
        <div className="bg-white border border-border p-6 space-y-6 rounded-sm shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-serif font-bold">Phase Management</h3>
                    <p className="text-sm text-muted font-sans uppercase tracking-widest">
                        {nextSteps.completed ? "Phase Complete" : "Phase in Progress"}
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-mono">{progress}%</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted">Screened</div>
                </div>
            </div>

            <div className="h-1 bg-paper w-full rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-ink"
                />
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono uppercase tracking-widest text-muted">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${nextSteps.conflicts === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {nextSteps.conflicts} Conflicts
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${nextSteps.remainingReviewers === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {nextSteps.remainingReviewers} Studies Awaiting Review
                </div>
            </div>

            {nextSteps.canMoveToNextPhase ? (
                <button
                    onClick={() => setShowConfirm(true)}
                    className="w-full btn-editorial bg-ink text-white hover:bg-ink/90 flex justify-center items-center gap-2"
                >
                    Move to {nextSteps.nextPhase} <ArrowRight className="w-4 h-4" />
                </button>
            ) : (
                <div className="w-full p-4 bg-paper border border-dashed border-border space-y-2">
                    <p className="text-muted text-sm font-serif italic text-center">
                        Phase advancement is locked.
                    </p>
                    <ul className="text-[10px] font-mono uppercase tracking-widest text-rose-500 space-y-1">
                        {nextSteps.totalPending > 0 && (
                            <li className="flex items-center gap-2">
                                <X className="w-3 h-3" /> {nextSteps.totalPending} items pending your review
                            </li>
                        )}
                        {nextSteps.remainingReviewers > 0 && (
                            <li className="flex items-center gap-2">
                                <X className="w-3 h-3" /> {nextSteps.remainingReviewers} studies still need additional reviews
                            </li>
                        )}
                        {nextSteps.conflicts > 0 && (
                            <li className="flex items-center gap-2">
                                <X className="w-3 h-3" /> {nextSteps.conflicts} unresolved conflicts
                            </li>
                        )}
                    </ul>
                </div>
            )}

            <AnimatePresence>
                {showConfirm && (
                    <div className="fixed inset-0 bg-ink/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white p-8 max-w-md w-full shadow-2xl space-y-6 border border-border"
                        >
                            <div className="space-y-2">
                                <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                                <h3 className="text-2xl font-serif">Confirm Phase Transition</h3>
                                <p className="text-muted italic">
                                    You are about to move all included studies to <span className="font-bold">{nextSteps.nextPhase}</span>.
                                    This action cannot be undone easily.
                                </p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 btn-editorial bg-white border-border hover:bg-paper"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleMovePhase}
                                    disabled={advancePhase.isPending}
                                    className="flex-1 btn-editorial bg-emerald-600 text-white hover:bg-emerald-700 border-transparent"
                                >
                                    {advancePhase.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm & Proceed"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
