import { motion } from "framer-motion";
import {
    Maximize2,
    Minimize2,
    AlignLeft,
    AlignJustify,
    Info,
    X,
    Loader2,
    History,
    Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PhaseSelector } from "./PhaseSelector";
import type { ScreeningPhase } from "@/types/screening";

interface ScreeningHeaderProps {
    currentIndex: number;
    totalStudies: number;
    currentPhase: ScreeningPhase;
    enabledPhases: ScreeningPhase[];
    onPhaseChange: (phase: ScreeningPhase) => void;
    progress: number;
    isFocused: boolean;
    toggleFocusMode: () => void;
    isMobile: boolean;
    viewDensity: "comfortable" | "compact";
    onToggleViewDensity: () => void;
    showCriteria: boolean;
    onToggleCriteria: () => void;
    isBatchMode: boolean;
    onToggleBatchMode: () => void;
    hasCriteria: boolean;
}

export function ScreeningHeader({
    currentIndex,
    totalStudies,
    currentPhase,
    enabledPhases,
    onPhaseChange,
    progress,
    isFocused,
    toggleFocusMode,
    isMobile,
    viewDensity,
    onToggleViewDensity,
    showCriteria,
    onToggleCriteria,
    isBatchMode,
    onToggleBatchMode,
    hasCriteria,
}: ScreeningHeaderProps) {
    return (
        <header
            className={cn(
                "flex justify-between items-center transition-all duration-500",
                isFocused ? "max-w-7xl mx-auto w-full mb-12" : "",
                // On mobile, compact the header
                isMobile ? "flex-col items-start gap-4" : ""
            )}
        >
            <div className="flex items-center gap-10 w-full justify-between lg:justify-start">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted font-bold hidden sm:inline">
                            Phase:
                        </span>
                        <PhaseSelector
                            currentPhase={currentPhase}
                            onPhaseChange={onPhaseChange}
                            enabledPhases={enabledPhases}
                            className="w-full max-w-[260px] lg:w-80"
                        />
                    </div>
                    <div className="h-4 w-[1px] bg-border" />
                    <span className="font-mono text-[10px] font-bold tracking-widest text-ink">
                        {currentIndex + 1} / {totalStudies}
                    </span>
                </div>
                <div className="hidden md:flex items-center gap-3">
                    <div className="h-1 w-40 bg-white border border-border/50 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-ink"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.8, ease: "circOut" }}
                        />
                    </div>
                    <span className="font-mono text-[9px] uppercase text-muted tracking-widest">
                        {Math.round(progress)}%
                    </span>
                </div>
            </div>

            <div className={cn("flex items-center gap-4", isMobile && "hidden")}>
                <ToolbarButton
                    onClick={toggleFocusMode}
                    icon={
                        isFocused ? (
                            <Minimize2 className="w-5 h-5" />
                        ) : (
                            <Maximize2 className="w-5 h-5" />
                        )
                    }
                    label={isFocused ? "Exit Focus" : "Focus Mode (F)"}
                />
                {!isMobile && (
                    <ToolbarButton
                        onClick={onToggleViewDensity}
                        icon={
                            viewDensity === "comfortable" ? (
                                <AlignJustify className="w-5 h-5" />
                            ) : (
                                <AlignLeft className="w-5 h-5" />
                            )
                        }
                        label={
                            viewDensity === "comfortable"
                                ? "Compact View"
                                : "Comfortable View"
                        }
                    />
                )}
                {isFocused && hasCriteria && (
                    <ToolbarButton
                        onClick={onToggleCriteria}
                        icon={<Info className="w-5 h-5" />}
                        label={showCriteria ? "Hide Criteria (C)" : "Show Criteria (C)"}
                    />
                )}
                <ToolbarButton
                    onClick={onToggleBatchMode}
                    icon={
                        isBatchMode ? (
                            <X className="w-5 h-5" />
                        ) : (
                            <Loader2 className="w-5 h-5 rotate-45" />
                        )
                    }
                    label={isBatchMode ? "Exit Batch" : "Batch Mode"}
                />
                {!isFocused && !isBatchMode && (
                    <>
                        <ToolbarButton
                            icon={<History className="w-5 h-5" />}
                            label="History"
                        />
                        <ToolbarButton
                            icon={<Keyboard className="w-5 h-5" />}
                            label="Shortcuts"
                        />
                    </>
                )}
            </div>
        </header>
    );
}

function ToolbarButton({
    icon,
    onClick,
    label,
}: {
    icon: React.ReactNode;
    onClick?: () => void;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            className="p-3 hover:bg-white rounded-full transition-all border border-transparent hover:border-border hover:shadow-sm group relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
        >
            {icon}
            <span className="absolute bottom-full right-0 mb-2 whitespace-nowrap bg-ink text-paper text-[9px] font-mono uppercase px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {label}
            </span>
        </button>
    );
}
