import type { ScreeningPhase } from "@/types/screening";
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Users,
    ArrowRight,
    ShieldAlert,
    BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PhaseSelector } from "./PhaseSelector";
import { ExportMenu } from "@/features/projects/components/ExportMenu";
import { useParams } from "next/navigation";

interface ScreeningStatsProps {
    currentPhase: ScreeningPhase;
    stats: {
        completed: boolean;
        totalPending: number;
        conflicts: number;
        remainingReviewers: number;
        phaseStats: {
            total: number;
            included: number;
            excluded: number;
            maybe: number;
        };
        canMoveToNextPhase: boolean;
        nextPhase?: ScreeningPhase;
    };
    onRefresh: () => void;
    onResolveConflicts?: () => void;
    onMoveToNextPhase?: () => void;
    onPhaseChange?: (phase: ScreeningPhase) => void;
}

export function ScreeningStats({
    currentPhase,
    stats,
    onRefresh,
    onResolveConflicts,
    onMoveToNextPhase,
    onPhaseChange
}: ScreeningStatsProps) {
    const params = useParams();
    const projectId = params.id as string;

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    const isBlocked = stats.conflicts > 0 || stats.remainingReviewers > 0;

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="max-w-4xl mx-auto space-y-12 py-12"
        >
            {/* Phase Selector */}
            {onPhaseChange && (
                <motion.div variants={item} className="flex justify-center mb-8">
                    <PhaseSelector
                        currentPhase={currentPhase}
                        onPhaseChange={onPhaseChange}
                        className="w-full max-w-md"
                    />
                </motion.div>
            )}

            {/* Header */}
            <motion.div variants={item} className="text-center space-y-4">
                <div className="w-20 h-20 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-4xl font-serif italic text-ink">You're all caught up!</h2>
                <p className="text-muted text-lg max-w-xl mx-auto font-serif">
                    You have no pending studies in the <span className="font-bold text-ink">{currentPhase}</span> phase.
                    Here is the team's progress.
                </p>
            </motion.div>

            {/* Main Stats Grid */}
            <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Progress Card */}
                <div className="p-8 bg-white border border-border shadow-sm rounded-sm space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <BarChart3 className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Total Screened</span>
                        <div className="text-5xl font-serif mt-2 text-ink">{stats.phaseStats.total}</div>
                        <div className="flex gap-4 mt-4 text-xs font-mono text-muted">
                            <span>Inc: {stats.phaseStats.included}</span>
                            <span>Exc: {stats.phaseStats.excluded}</span>
                        </div>
                    </div>
                </div>

                {/* Conflicts Card */}
                <div className={cn(
                    "p-8 border shadow-sm rounded-sm space-y-4 relative overflow-hidden transition-colors",
                    stats.conflicts > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-border"
                )}>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start">
                            <span className={cn(
                                "text-[10px] font-mono uppercase tracking-widest",
                                stats.conflicts > 0 ? "text-amber-700 font-bold" : "text-muted"
                            )}>
                                Create Conflicts
                            </span>
                            {stats.conflicts > 0 && <ShieldAlert className="w-5 h-5 text-amber-600 animate-pulse" />}
                        </div>

                        <div className={cn(
                            "text-5xl font-serif mt-2",
                            stats.conflicts > 0 ? "text-amber-900" : "text-ink"
                        )}>
                            {stats.conflicts}
                        </div>

                        {stats.conflicts > 0 && (
                            <button
                                onClick={onResolveConflicts}
                                className="mt-4 text-xs font-bold uppercase tracking-wider text-amber-700 hover:text-amber-900 underline underline-offset-4 decoration-amber-300"
                            >
                                Resolve Now →
                            </button>
                        )}
                    </div>
                </div>

                {/* Team Status Card */}
                <div className={cn(
                    "p-8 border shadow-sm rounded-sm space-y-4 relative overflow-hidden",
                    stats.remainingReviewers > 0 ? "bg-blue-50 border-blue-200" : "bg-white border-border"
                )}>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start">
                            <span className={cn(
                                "text-[10px] font-mono uppercase tracking-widest",
                                stats.remainingReviewers > 0 ? "text-blue-700 font-bold" : "text-muted"
                            )}>
                                Pending Reviewers
                            </span>
                            {stats.remainingReviewers > 0 ? (
                                <Clock className="w-5 h-5 text-blue-600 animate-spin-slow" />
                            ) : (
                                <Users className="w-5 h-5 text-muted" />
                            )}
                        </div>

                        <div className={cn(
                            "text-5xl font-serif mt-2",
                            stats.remainingReviewers > 0 ? "text-blue-900" : "text-ink"
                        )}>
                            {stats.remainingReviewers}
                        </div>

                        <div className={cn(
                            "text-xs mt-4",
                            stats.remainingReviewers > 0 ? "text-blue-700" : "text-muted"
                        )}>
                            {stats.remainingReviewers > 0 ? "Waiting for team..." : "All caught up"}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Action Area */}
            <motion.div variants={item} className="flex justify-center pt-8">
                {stats.canMoveToNextPhase ? (
                    <button
                        onClick={onMoveToNextPhase}
                        className="group relative inline-flex items-center justify-center px-8 py-4 font-serif text-lg text-white bg-emerald-600 rounded-sm overflow-hidden transition-all hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-0.5"
                    >
                        <span className="relative z-10 flex items-center gap-3">
                            Start {stats.nextPhase} Phase
                            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ) : currentPhase === 'FULL_TEXT' && stats.completed && !isBlocked ? (
                    <button
                        onClick={() => window.location.href = `/projects/${projectId}/extraction`}
                        className="group relative inline-flex items-center justify-center px-8 py-4 font-serif text-lg text-white bg-indigo-600 rounded-sm overflow-hidden transition-all hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5"
                    >
                        <span className="relative z-10 flex items-center gap-3">
                            Proceed to Data Extraction
                            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ) : (
                    <div className="flex gap-4">
                        <button
                            onClick={onRefresh}
                            className="px-8 py-3 bg-white border border-border hover:border-ink hover:text-ink text-muted font-mono uppercase text-xs tracking-widest transition-all rounded-sm"
                        >
                            Check for Updates
                        </button>
                        <button className="px-8 py-3 bg-ink text-paper font-mono uppercase text-xs tracking-widest hover:bg-ink/90 transition-all rounded-sm">
                            Return to Dashboard
                        </button>
                        <ExportMenu projectId={projectId} className="px-8 py-3 h-auto" />
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
