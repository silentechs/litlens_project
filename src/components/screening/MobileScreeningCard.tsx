"use client";

import { useState, useCallback } from "react";
import {
    Check,
    X,
    HelpCircle,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Bookmark,
    Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ============== TYPES ==============

interface Study {
    id: string;
    title: string;
    authors: string;
    year: number | null;
    journal: string | null;
    abstract: string | null;
    doi: string | null;
    aiSuggestion?: "include" | "exclude" | "maybe";
    aiConfidence?: number;
    aiReasoning?: string;
}

interface MobileScreeningCardProps {
    study: Study;
    currentIndex: number;
    totalCount: number;
    onDecision: (decision: "include" | "exclude" | "maybe", reasoning?: string) => Promise<void>;
    onSkip: () => void;
    onPrevious: () => void;
    isLoading?: boolean;
    className?: string;
}

// ============== MAIN COMPONENT ==============

export function MobileScreeningCard({
    study,
    currentIndex,
    totalCount,
    onDecision,
    onSkip,
    onPrevious,
    isLoading = false,
    className,
}: MobileScreeningCardProps) {
    const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
    const [showAIInsight, setShowAIInsight] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDecision = async (decision: "include" | "exclude" | "maybe") => {
        setIsSubmitting(true);
        try {
            await onDecision(decision);
        } finally {
            setIsSubmitting(false);
        }
    };

    const progress = ((currentIndex + 1) / totalCount) * 100;

    return (
        <div className={cn(
            "flex flex-col h-full bg-paper",
            className
        )}>
            {/* Progress Bar */}
            <div className="h-1 bg-border">
                <div
                    className="h-full bg-ink transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <button
                    onClick={onPrevious}
                    disabled={currentIndex === 0}
                    className="p-2 -ml-2 text-muted hover:text-ink disabled:opacity-30"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                <span className="font-mono text-xs text-muted">
                    {currentIndex + 1} / {totalCount}
                </span>

                <button
                    onClick={onSkip}
                    className="p-2 -mr-2 text-muted hover:text-ink"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* AI Badge */}
                {study.aiSuggestion && (
                    <button
                        onClick={() => setShowAIInsight(!showAIInsight)}
                        className="w-full"
                    >
                        <div className={cn(
                            "p-3 rounded-sm border flex items-center justify-between",
                            study.aiSuggestion === "include" && "border-green-500 bg-green-50",
                            study.aiSuggestion === "exclude" && "border-red-500 bg-red-50",
                            study.aiSuggestion === "maybe" && "border-yellow-500 bg-yellow-50",
                        )}>
                            <div className="flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                    AI suggests: {study.aiSuggestion}
                                </span>
                            </div>
                            <span className="text-xs text-muted">
                                {Math.round((study.aiConfidence || 0) * 100)}% confident
                            </span>
                        </div>

                        {showAIInsight && study.aiReasoning && (
                            <p className="mt-2 text-sm text-muted italic text-left px-3">
                                {study.aiReasoning}
                            </p>
                        )}
                    </button>
                )}

                {/* Title */}
                <h1 className="text-xl font-serif leading-tight">{study.title}</h1>

                {/* Metadata */}
                <div className="flex flex-wrap gap-2 text-sm text-muted">
                    <span>{study.authors}</span>
                    {study.year && <span>• {study.year}</span>}
                    {study.journal && <span className="italic">• {study.journal}</span>}
                </div>

                {/* DOI Link */}
                {study.doi && (
                    <a
                        href={`https://doi.org/${study.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-intel-blue text-sm"
                    >
                        View full text <ExternalLink className="w-3 h-3" />
                    </a>
                )}

                {/* Abstract */}
                {study.abstract && (
                    <div className="space-y-2">
                        <p className="font-mono text-xs uppercase tracking-widest text-muted">
                            Abstract
                        </p>
                        <p className={cn(
                            "text-sm leading-relaxed",
                            !isAbstractExpanded && "line-clamp-6"
                        )}>
                            {study.abstract}
                        </p>
                        {study.abstract.length > 400 && (
                            <button
                                onClick={() => setIsAbstractExpanded(!isAbstractExpanded)}
                                className="text-sm text-intel-blue font-medium"
                            >
                                {isAbstractExpanded ? "Show less" : "Show more"}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <div className="border-t border-border bg-white p-4 safe-area-inset-bottom">
                <div className="grid grid-cols-3 gap-3">
                    <DecisionButton
                        type="exclude"
                        onClick={() => handleDecision("exclude")}
                        disabled={isSubmitting || isLoading}
                    />
                    <DecisionButton
                        type="maybe"
                        onClick={() => handleDecision("maybe")}
                        disabled={isSubmitting || isLoading}
                    />
                    <DecisionButton
                        type="include"
                        onClick={() => handleDecision("include")}
                        disabled={isSubmitting || isLoading}
                    />
                </div>
            </div>
        </div>
    );
}

// ============== SUB-COMPONENTS ==============

interface DecisionButtonProps {
    type: "include" | "exclude" | "maybe";
    onClick: () => void;
    disabled?: boolean;
}

function DecisionButton({ type, onClick, disabled }: DecisionButtonProps) {
    const config = {
        include: {
            icon: Check,
            label: "Include",
            colors: "bg-green-600 hover:bg-green-700 text-white active:bg-green-800",
        },
        exclude: {
            icon: X,
            label: "Exclude",
            colors: "bg-red-500 hover:bg-red-600 text-white active:bg-red-700",
        },
        maybe: {
            icon: HelpCircle,
            label: "Maybe",
            colors: "bg-yellow-500 hover:bg-yellow-600 text-white active:bg-yellow-700",
        },
    };

    const { icon: Icon, label, colors } = config[type];

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "flex flex-col items-center justify-center py-4 rounded-lg transition-all",
                "disabled:opacity-50 disabled:pointer-events-none",
                colors
            )}
        >
            <Icon className="w-6 h-6 mb-1" />
            <span className="text-sm font-medium">{label}</span>
        </button>
    );
}

export default MobileScreeningCard;
