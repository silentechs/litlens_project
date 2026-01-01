import { Button } from "@/components/ui/button";
import { ConfidenceSlider } from "./ConfidenceSlider";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, X, HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScreeningDecision } from "@/types/screening";

interface ScreeningDecisionControlsProps {
    onDecision: (decision: ScreeningDecision | "MAYBE") => void;
    currentDecision?: ScreeningDecision | "MAYBE" | null;
    isPending: boolean;
    viewDensity: "comfortable" | "compact";
    confidence: number;
    setConfidence: (value: number) => void;
    notes: string;
    setNotes: (value: string) => void;
    showNotes: boolean;
    setShowNotes: (show: boolean) => void;
    onNext: () => void;
    onPrevious: () => void;
    canGoNext: boolean;
    canGoPrevious: boolean;
}

export function ScreeningDecisionControls({
    onDecision,
    currentDecision,
    isPending,
    viewDensity,
    confidence,
    setConfidence,
    notes,
    setNotes,
    showNotes,
    setShowNotes,
    onNext,
    onPrevious,
    canGoNext,
    canGoPrevious
}: ScreeningDecisionControlsProps) {
    return (
        <div className="col-span-4 border-l border-border/50 pl-20 flex flex-col justify-center space-y-20">
            <div className="space-y-12">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted font-black">Adjudication</h3>
                <div className="space-y-6">
                    <DecisionButton
                        label="Include"
                        shortcut="I"
                        icon={<Check className="w-8 h-8" />}
                        color="green"
                        active={currentDecision === 'INCLUDE'}
                        loading={isPending}
                        onClick={() => onDecision('INCLUDE')}
                        viewDensity={viewDensity}
                    />

                    <div className="bg-muted/10 p-4 rounded-md space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono uppercase text-muted font-bold">Confidence</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowNotes(!showNotes)}
                                className="h-6 text-[10px]"
                            >
                                {showNotes ? "Hide Notes" : "Add Notes"}
                            </Button>
                        </div>
                        <ConfidenceSlider
                            value={confidence}
                            onChange={setConfidence}
                        />
                        {showNotes && (
                            <Textarea
                                placeholder="Reasoning..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="text-xs min-h-[60px]"
                            />
                        )}
                    </div>

                    <DecisionButton
                        label="Exclude"
                        shortcut="E"
                        icon={<X className="w-8 h-8" />}
                        color="red"
                        active={currentDecision === 'EXCLUDE'}
                        loading={isPending}
                        onClick={() => onDecision('EXCLUDE')}
                        viewDensity={viewDensity}
                    />

                    <DecisionButton
                        label="Maybe"
                        shortcut="M"
                        icon={<HelpCircle className="w-8 h-8" />}
                        color="muted"
                        active={currentDecision === 'MAYBE'}
                        loading={isPending}
                        onClick={() => onDecision('MAYBE')}
                        viewDensity={viewDensity}
                    />
                </div>
            </div>

            <div className="pt-20 border-t border-border/30 space-y-8">
                <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.2em] text-muted">
                    <span>Navigate Workspace</span>
                    <div className="flex gap-4">
                        <button
                            onClick={onPrevious}
                            disabled={!canGoPrevious}
                            aria-label="Previous Study"
                            className="p-3 hover:bg-white border border-border/60 hover:border-ink rounded-sm transition-all shadow-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onNext}
                            disabled={!canGoNext}
                            aria-label="Next Study"
                            className="p-3 hover:bg-white border border-border/60 hover:border-ink rounded-sm transition-all shadow-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="p-6 bg-white/50 border border-border/40 rounded-sm">
                    <p className="text-[11px] text-muted-foreground font-serif italic leading-relaxed">
                        Screening decisions are currently <span className="font-bold text-ink">blind</span>. Your assessment will remain confidential until the consensus phase.
                    </p>
                </div>
            </div>
        </div>
    );
}

function DecisionButton({ label, shortcut, icon, color, active, loading, onClick, viewDensity = 'comfortable' }: {
    label: string,
    shortcut: string,
    icon: React.ReactNode,
    color: 'green' | 'red' | 'muted',
    active: boolean,
    loading?: boolean,
    onClick: () => void,
    viewDensity?: 'comfortable' | 'compact'
}) {
    const colors = {
        green: "hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-400",
        red: "hover:bg-rose-50 hover:text-rose-800 hover:border-rose-400",
        muted: "hover:bg-paper hover:text-ink hover:border-ink"
    };

    const activeColors = {
        green: "bg-emerald-50 text-emerald-800 border-emerald-500 shadow-md translate-x-1",
        red: "bg-rose-50 text-rose-800 border-rose-500 shadow-md translate-x-1",
        muted: "bg-paper text-ink border-ink shadow-md translate-x-1"
    };

    return (
        <button
            onClick={onClick}
            disabled={loading}
            aria-label={`${label} (Shortcut: ${shortcut})`}
            className={cn(
                "w-full flex items-center justify-between p-10 border transition-all duration-500 group rounded-sm outline-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2",
                active ? activeColors[color] : cn("border-border/40 bg-white", colors[color])
            )}
        >
            <div className="flex items-center gap-10">
                <div className={cn(
                    "w-16 h-16 flex items-center justify-center border transition-all duration-700 ease-out",
                    active ? "border-current rotate-0 scale-110" : "border-border/30 group-hover:border-current -rotate-12 group-hover:rotate-0"
                )}>
                    {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : icon}
                </div>
                <span className={cn(
                    "font-serif italic tracking-tighter transition-all group-hover:translate-x-2",
                    viewDensity === 'comfortable' ? "text-5xl" : "text-2xl"
                )}>{label}</span>
            </div>
            <kbd className="hidden group-hover:block font-mono text-[10px] opacity-20 tracking-[0.3em] font-black">{shortcut}</kbd>
        </button>
    );
}
