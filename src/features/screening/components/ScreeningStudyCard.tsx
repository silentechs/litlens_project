import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { SwipeableCard } from "./SwipeableCard";
import { DualScreeningStatus } from "./DualScreeningStatus";
import { KeywordHighlighter } from "./KeywordHighlighter";
import { MetadataBadge } from "./MetadataBadge";
import { FullTextControls } from "./FullTextControls";
import { StudyTags } from "./StudyTags";
import type { ScreeningQueueItem } from "@/lib/api-client";

interface ScreeningStudyCardProps {
    study: ScreeningQueueItem;
    projectId: string;
    viewDensity: "comfortable" | "compact";
    isMobile: boolean;
    keywords: string[];
    onSwipe: (direction: "left" | "right" | "up") => void;
    onAskAI: () => void;
    onUpdate: () => void;
}

export function ScreeningStudyCard({
    study,
    projectId,
    viewDensity,
    isMobile,
    keywords,
    onSwipe,
    onAskAI,
    onUpdate
}: ScreeningStudyCardProps) {
    const authorsDisplay = study.authors.map(a => a.name).join(", ");

    return (
        <SwipeableCard onSwipe={onSwipe} disabled={!isMobile}>
            <AnimatePresence mode="wait">
                <motion.article
                    key={study.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-16"
                >
                    <div className="space-y-8">
                        {/* Dual Screening Status */}
                        {study.reviewerStatus && (
                            <DualScreeningStatus
                                reviewerStatus={study.reviewerStatus}
                                votedReviewers={study.votedReviewers}
                                totalReviewersNeeded={study.totalReviewersNeeded}
                                reviewersVoted={study.reviewersVoted}
                            />
                        )}

                        <h2 className={cn(
                            "font-serif leading-[1.05] tracking-tight text-ink decoration-intel-blue/20 underline-offset-8",
                            viewDensity === 'comfortable'
                                ? "text-3xl md:text-5xl lg:text-7xl"
                                : "text-xl md:text-2xl lg:text-3xl"
                        )}>
                            <KeywordHighlighter
                                text={study.title}
                                keywords={keywords || []}
                            />
                        </h2>
                        <div className="flex flex-wrap items-center gap-8 text-[11px] font-mono uppercase tracking-[0.25em] text-muted">
                            <span className="font-bold text-ink/80">{authorsDisplay}</span>
                            {study.journal && (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-intel-blue/40" />
                                    <span className="italic">{study.journal}</span>
                                </>
                            )}
                            {study.year && (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-intel-blue/40" />
                                    <span>{study.year}</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="accent-line opacity-20" />

                    <div className="space-y-10">
                        <div className="flex items-center gap-4">
                            <h3 className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted font-black">Abstract Synthesis</h3>
                            <div className="flex-1 h-px bg-border/30" />
                            <button
                                onClick={onAskAI}
                                className="flex items-center gap-2 px-3 py-1.5 bg-intel-blue/5 hover:bg-intel-blue/10 border border-intel-blue/20 rounded-full transition-colors text-intel-blue group focus-visible:outline focus-visible:outline-2 focus-visible:outline-intel-blue"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Ask AI</span>
                            </button>
                        </div>
                        <p className={cn(
                            "font-serif italic text-ink/90 first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-ink first-letter:leading-none select-text",
                            viewDensity === 'comfortable'
                                ? "text-lg md:text-2xl lg:text-3xl leading-[1.55] first-letter:text-5xl md:first-letter:text-8xl"
                                : "text-sm md:text-base lg:text-lg leading-[1.6] first-letter:text-3xl md:first-letter:text-5xl"
                        )}>
                            <KeywordHighlighter
                                text={study.abstract || "No abstract available."}
                                keywords={keywords || []}
                            />
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-6 pt-12">
                        {study.aiSuggestion && study.aiConfidence && (
                            <MetadataBadge
                                icon={<Sparkles className="w-3.5 h-3.5 text-intel-blue animate-pulse" />}
                                label={`AI Prediction: ${study.aiSuggestion} (${Math.round(study.aiConfidence * 100)}%)`}
                                variant="intel"
                            />
                        )}
                        {study.doi && (
                            <MetadataBadge
                                icon={<Info className="w-3.5 h-3.5" />}
                                label={`DOI: ${study.doi}`}
                            />
                        )}

                        <FullTextControls
                            projectId={projectId}
                            projectWorkId={study.id}
                            workUrl={study.url}
                            doi={study.doi}
                            title={study.title}
                            pdfR2Key={study.pdfR2Key}
                            ingestionStatus={study.ingestionStatus}
                            ingestionError={study.ingestionError}
                            chunksCreated={study.chunksCreated}
                            onChanged={onUpdate}
                        />
                    </div>

                    {/* Study Tags */}
                    <div className="pt-8 border-t border-border/30">
                        <StudyTags
                            projectId={projectId}
                            projectWorkId={study.id}
                            tags={study.tags || []}
                            onUpdate={onUpdate}
                            editable={true}
                        />
                    </div>
                </motion.article>
            </AnimatePresence>
        </SwipeableCard>
    );
}
