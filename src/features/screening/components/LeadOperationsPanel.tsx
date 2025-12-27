"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Users,
    Sparkles,
    ArrowRight,
    RotateCcw,
    CheckCircle2,
    Loader2
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { screeningApi, type ScreeningBatchParams, type ScreeningPhase, type ScreeningDecision } from "@/lib/api-client";
import { useProjectMembers } from "@/features/team/api/queries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface LeadOperationsPanelProps {
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
    selectedIds: string[];
    onClearSelection: () => void;
    currentPhase: ScreeningPhase;
}

type BatchMode = 'assign' | 'ai' | 'move' | 'reset' | null;

export function LeadOperationsPanel({
    projectId,
    isOpen,
    onClose,
    selectedIds,
    onClearSelection,
    currentPhase
}: LeadOperationsPanelProps) {
    const [mode, setMode] = useState<BatchMode>(null);
    const queryClient = useQueryClient();
    const { data: membersData } = useProjectMembers(projectId);

    // Form states
    const [assigneeId, setAssigneeId] = useState<string>("");
    const [aiThreshold, setAiThreshold] = useState<string>("0.8");
    const [targetPhase, setTargetPhase] = useState<string>(
        currentPhase === "TITLE_ABSTRACT" ? "FULL_TEXT" : "FINAL"
    );

    const batchMutation = useMutation({
        mutationFn: (params: ScreeningBatchParams) => screeningApi.batch(projectId, params),
        onSuccess: (data) => {
            toast.success(`Processed ${data.processed} studies`);
            if (data.failed > 0) {
                toast.warning(`${data.failed} studies failed to process`);
            }
            queryClient.invalidateQueries({ queryKey: ["screening-queue"] });
            queryClient.invalidateQueries({ queryKey: ["screening-stats"] });
            onClearSelection();
            onClose();
            setMode(null);
        },
        onError: (err) => {
            toast.error("Batch operation failed: " + err.message);
        }
    });

    const handleExecute = () => {
        if (!mode) return;

        const params: ScreeningBatchParams = {
            operation: mode === 'move' ? 'move_phase' :
                mode === 'ai' ? 'apply_ai' :
                    mode === 'assign' ? 'assign' : 'reset',
            projectWorkIds: selectedIds,
        };

        if (mode === 'assign') {
            if (!assigneeId) return toast.error("Please select a reviewer");
            params.assigneeId = assigneeId;
        }

        if (mode === 'ai') {
            params.aiConfidenceThreshold = parseFloat(aiThreshold);
        }

        if (mode === 'move') {
            params.targetPhase = targetPhase as ScreeningPhase;
        }

        batchMutation.mutate(params);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-ink/20 backdrop-blur-sm z-[60]"
                    />
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed top-0 right-0 h-full w-[400px] bg-white border-l border-border shadow-2xl z-[70] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-border bg-paper">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-serif italic text-ink">Batch Operations</h2>
                                    <p className="text-xs font-mono uppercase tracking-widest text-muted mt-1">
                                        {selectedIds.length} Studies Selected
                                    </p>
                                </div>
                                <button onClick={onClose} className="p-1 hover:bg-white rounded-full transition-colors">
                                    <X className="w-5 h-5 text-muted hover:text-ink" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {!mode ? (
                                <div className="grid grid-cols-1 gap-4">
                                    <ActionCard
                                        icon={<Users className="w-5 h-5 text-blue-600" />}
                                        title="Assign to Reviewer"
                                        desc="Distribute selected studies to specific team members."
                                        onClick={() => setMode('assign')}
                                    />
                                    <ActionCard
                                        icon={<Sparkles className="w-5 h-5 text-purple-600" />}
                                        title="Apply AI Suggestions"
                                        desc="Auto-accept AI decisions with high confidence."
                                        onClick={() => setMode('ai')}
                                    />
                                    <ActionCard
                                        icon={<ArrowRight className="w-5 h-5 text-emerald-600" />}
                                        title="Move Phase"
                                        desc="Batch promote included studies to next phase."
                                        onClick={() => setMode('move')}
                                    />
                                    <ActionCard
                                        icon={<RotateCcw className="w-5 h-5 text-rose-600" />}
                                        title="Reset Decisions"
                                        desc="Clear all judgments and conflicts for re-screening."
                                        onClick={() => setMode('reset')}
                                        danger
                                    />
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                    <button
                                        onClick={() => setMode(null)}
                                        className="text-xs font-mono uppercase tracking-widest text-muted hover:text-ink flex items-center gap-2 mb-4"
                                    >
                                        <ArrowRight className="w-3 h-3 rotate-180" /> Back to Actions
                                    </button>

                                    {mode === 'assign' && (
                                        <div className="space-y-4">
                                            <h3 className="font-serif italic text-lg flex items-center gap-2">
                                                <Users className="w-4 h-4" /> Assign Reviewer
                                            </h3>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-widest text-muted">Select Member</label>
                                                <Select value={assigneeId} onValueChange={setAssigneeId}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Choose reviewer..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {membersData?.members.map((m) => (
                                                            <SelectItem key={m.userId} value={m.userId}>
                                                                {m.user.name || m.user.email}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}

                                    {mode === 'ai' && (
                                        <div className="space-y-4">
                                            <h3 className="font-serif italic text-lg flex items-center gap-2">
                                                <Sparkles className="w-4 h-4" /> Auto-Apply AI
                                            </h3>
                                            <div className="p-4 bg-purple-50 text-purple-900 text-sm font-serif italic border border-purple-100 rounded-sm">
                                                This will accept AI decisions for pending studies where confidence is above the threshold.
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-widest text-muted">Confidence Threshold</label>
                                                <Select value={aiThreshold} onValueChange={setAiThreshold}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="0.9">90% (Strict)</SelectItem>
                                                        <SelectItem value="0.8">80% (Recommended)</SelectItem>
                                                        <SelectItem value="0.7">70% (Lenient)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}

                                    {mode === 'move' && (
                                        <div className="space-y-4">
                                            <h3 className="font-serif italic text-lg flex items-center gap-2">
                                                <ArrowRight className="w-4 h-4" /> Move Phase
                                            </h3>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase tracking-widest text-muted">Target Phase</label>
                                                <Select value={targetPhase} onValueChange={setTargetPhase}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="FULL_TEXT">Full-Text Screening</SelectItem>
                                                        <SelectItem value="FINAL">Final Inclusion</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}

                                    {mode === 'reset' && (
                                        <div className="space-y-4">
                                            <h3 className="font-serif italic text-lg flex items-center gap-2 text-rose-600">
                                                <RotateCcw className="w-4 h-4" /> Reset Decisions
                                            </h3>
                                            <div className="p-4 bg-rose-50 text-rose-900 text-sm font-serif italic border border-rose-100 rounded-sm">
                                                Warning: This will permanently delete all decisions and conflicts for the {selectedIds.length} selected studies in the current phase.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {mode && (
                            <div className="p-6 border-t border-border bg-paper">
                                <Button
                                    onClick={handleExecute}
                                    disabled={batchMutation.isPending}
                                    className={cn(
                                        "w-full gap-2 font-mono uppercase tracking-widest",
                                        mode === 'reset' ? "bg-rose-600 hover:bg-rose-700" : "bg-ink hover:bg-ink/90"
                                    )}
                                >
                                    {batchMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {mode === 'reset' ? 'Confirm Reset' : 'Execute Batch'}
                                </Button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function ActionCard({ icon, title, desc, onClick, danger }: { icon: any, title: string, desc: string, onClick: () => void, danger?: boolean }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left p-4 border rounded-sm transition-all hover:shadow-md group",
                danger
                    ? "border-rose-100 bg-rose-50/30 hover:bg-rose-50 hover:border-rose-200"
                    : "border-border bg-white hover:border-ink"
            )}
        >
            <div className="flex items-start gap-4">
                <div className={cn(
                    "p-2 rounded-full shrink-0",
                    danger ? "bg-rose-100" : "bg-paper"
                )}>
                    {icon}
                </div>
                <div>
                    <h4 className={cn("font-serif font-bold italic", danger ? "text-rose-700" : "text-ink")}>{title}</h4>
                    <p className="text-xs text-muted mt-1 leading-relaxed">{desc}</p>
                </div>
                <ArrowRight className={cn(
                    "ml-auto w-4 h-4 opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 mt-2",
                    danger ? "text-rose-400" : "text-muted"
                )} />
            </div>
        </button>
    );
}
