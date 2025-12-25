"use client";

import { useState } from "react";
import { useScreeningNextSteps, useAdvancePhase } from "@/features/screening/api/queries";
import { Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PhaseManagerProps {
    projectId: string;
}

export function PhaseManager({ projectId }: PhaseManagerProps) {
    const { data: nextSteps, isLoading, refetch } = useScreeningNextSteps(projectId);
    const advancePhase = useAdvancePhase(projectId);
    const [showConfirm, setShowConfirm] = useState(false);

    if (isLoading || !nextSteps) return null;

    const progress = nextSteps.phaseStats.total > 0
        ? Math.round(((nextSteps.phaseStats.total - nextSteps.totalPending) / nextSteps.phaseStats.total) * 100)
        : 0;

    const handleMovePhase = async () => {
        if (!nextSteps.nextPhase) return;

        try {
            // Use the dedicated advance-phase API endpoint
            await advancePhase.mutateAsync({
                currentPhase: "TITLE_ABSTRACT" // TODO: Get actual current phase from context
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
                    {nextSteps.remainingReviewers} Team Pending
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
                <div className="w-full p-4 bg-paper text-center border border-dashed border-border text-muted text-sm font-serif italic">
                    Complete screening and resolve conflicts to proceed.
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
