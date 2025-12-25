"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ScreeningPhase } from "@/types/screening";

interface PhaseSelectorProps {
    currentPhase: ScreeningPhase;
    onPhaseChange: (phase: ScreeningPhase) => void;
    className?: string;
}

const PHASES: { value: ScreeningPhase; label: string }[] = [
    { value: "TITLE_ABSTRACT", label: "Title/Abstract" },
    { value: "FULL_TEXT", label: "Full Text" },
    { value: "FINAL", label: "Final" },
];

export function PhaseSelector({ currentPhase, onPhaseChange, className }: PhaseSelectorProps) {
    return (
        <div className={cn("relative flex p-1 bg-white border border-border/40 rounded-sm shadow-sm", className)}>
            {/* Floating active indicator */}
            <AnimatePresence initial={false}>
                <motion.div
                    key="indicator"
                    className="absolute h-[calc(100%-8px)] rounded-sm bg-ink shadow-editorial"
                    animate={{
                        x: PHASES.findIndex((p) => p.value === currentPhase) * 100 + "%",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    style={{ width: `calc(${100 / PHASES.length}% - 4px)`, left: 4, top: 4 }}
                />
            </AnimatePresence>

            {PHASES.map((phase) => {
                const isActive = currentPhase === phase.value;
                return (
                    <button
                        key={phase.value}
                        onClick={() => onPhaseChange(phase.value)}
                        className={cn(
                            "relative z-10 flex-1 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-300",
                            isActive ? "text-paper font-black" : "text-muted hover:text-ink font-bold"
                        )}
                    >
                        {phase.label}
                    </button>
                );
            })}
        </div>
    );
}
