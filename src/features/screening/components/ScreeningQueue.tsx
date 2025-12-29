"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useScreeningStore } from "@/stores/screening-store";
import { useScreeningQueue, useSubmitDecision, useScreeningNextSteps as useScreeningQueueNextSteps, useAdvancePhase } from "@/features/screening/api/queries";
import { useProject, useProjectStats } from "@/features/projects/api/queries";
import { useAppStore } from "@/stores/app-store";
import type { ScreeningDecision, ScreeningQueueItem, ScreeningPhase } from "@/types/screening";
import { useMemo } from "react";
import {
  Check,
  X,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Keyboard,
  History,
  Info,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ExclusionReasonModal } from "./ExclusionReasonModal";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ConfidenceSlider } from "./ConfidenceSlider";
import { Textarea } from "@/components/ui/textarea";
import { KeywordHighlighter } from "./KeywordHighlighter";
import { ScreeningStats } from "./ScreeningStats";
import { PhaseSelector } from "./PhaseSelector";
import { LeadOperationsPanel } from "./LeadOperationsPanel";
import { SwipeableCard } from "./SwipeableCard";
import { DualScreeningStatus } from "./DualScreeningStatus";
import { ScreeningFilters } from "./ScreeningFilters";
import { EligibilityCriteriaPanel } from "./EligibilityCriteriaPanel";
import { StudyTags } from "./StudyTags";
import { ChatInterface } from "@/features/ai/components/ChatInterface";
import { FullTextControls } from "./FullTextControls";
// import { Message } from "ai";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Simple hook for responsive check
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export function ScreeningQueue() {
  const router = useRouter();
  const { currentProjectId } = useAppStore();
  const {
    currentIndex,
    isFocusMode: isFocused,
    currentPhase,
    setCurrentPhase,
    next,
    previous,
    toggleFocusMode,
    setCurrentIndex,
    startDecisionTimer,
    getDecisionTime,
  } = useScreeningStore();

  const [showChat, setShowChat] = useState(false);
  const [showExclusionModal, setShowExclusionModal] = useState(false);
  const [pendingExclusionStudyId, setPendingExclusionStudyId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(80);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  // Batch Mode State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatchPanel, setShowBatchPanel] = useState(false);

  // Filtering and Sorting State
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("aiConfidence");
  const [filterDecision, setFilterDecision] = useState<string | undefined>(undefined);

  // Eligibility Criteria Panel State
  const [showCriteria, setShowCriteria] = useState(false);
  const [criteria, setCriteria] = useState<any>(null);

  const isMobile = useIsMobile();

  // Fetch screening queue from API
  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useScreeningQueue(currentProjectId || undefined, {
    phase: currentPhase,
    limit: 100,
    search: searchTerm || undefined,
    sortBy: sortBy,
    status: filterDecision,
  });

  // Submit decision mutation
  const submitDecision = useSubmitDecision(currentProjectId || "");

  // Move hooks to top level
  const { data: nextSteps, isLoading: isLoadingNextSteps } = useScreeningQueueNextSteps(currentProjectId || undefined, currentPhase);
  const { data: project } = useProject(currentProjectId || undefined);
  const { data: projectStats } = useProjectStats(currentProjectId || undefined);
  const enabledPhases = useMemo(() => {
    // Conservative default: only enable phases we know exist in this project.
    const titleAbstractTotal = projectStats?.phaseTotals?.titleAbstract ?? 0;
    const fullTextTotal = projectStats?.phaseTotals?.fullText ?? 0;
    const finalTotal = projectStats?.phaseTotals?.final ?? 0;

    const phases: ScreeningPhase[] = ["TITLE_ABSTRACT"];
    if (fullTextTotal > 0) phases.push("FULL_TEXT");
    if (finalTotal > 0) phases.push("FINAL");

    // Always allow the currently selected phase (prevents locking the user into an invalid UI state).
    if (!phases.includes(currentPhase)) phases.push(currentPhase);

    return phases;
  }, [projectStats?.phaseTotals?.titleAbstract, projectStats?.phaseTotals?.fullText, projectStats?.phaseTotals?.final, currentPhase]);

  // Phase advancement mutation
  const advancePhase = useAdvancePhase(currentProjectId || "");

  const studies = data?.items || [];
  const currentStudy = studies[currentIndex] as ScreeningQueueItem | undefined;
  const totalStudies = studies.length;

  // Start timer when study changes
  useEffect(() => {
    if (currentStudy) {
      startDecisionTimer();
    }
  }, [currentStudy?.id, startDecisionTimer]);

  // Keep current index in bounds after queue refetch
  useEffect(() => {
    if (currentIndex >= studies.length && studies.length > 0) {
      setCurrentIndex(studies.length - 1);
    } else if (studies.length === 0) {
      setCurrentIndex(0);
    }
  }, [studies.length, currentIndex, setCurrentIndex]);

  // Fetch eligibility criteria
  useEffect(() => {
    if (currentProjectId) {
      fetch(`/api/projects/${currentProjectId}/eligibility-criteria`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.data?.exists) {
            setCriteria(data.data.criteria);
          }
        })
        .catch(console.error);
    }
  }, [currentProjectId]);

  // Handle select all
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === studies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(studies.map(s => s.id));
    }
  }, [studies, selectedIds]);

  // Handle single selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  // Handle decision - opens modal for EXCLUDE, submits directly for others
  const handleDecision = useCallback((decision: ScreeningDecision | "MAYBE") => {
    if (!currentStudy || !currentProjectId) return;

    // For EXCLUDE, always show the modal to get a reason
    if (decision === 'EXCLUDE') {
      setPendingExclusionStudyId(currentStudy.id);
      setShowExclusionModal(true);
      return;
    }

    const timeSpentMs = getDecisionTime();

    submitDecision.mutate(
      {
        projectWorkId: currentStudy.id,
        phase: currentPhase,
        decision: decision as ScreeningDecision,
        confidence: confidence,
        reasoning: notes,
        timeSpentMs: timeSpentMs || undefined,
        followedAi: currentStudy.aiSuggestion ? decision === currentStudy.aiSuggestion : undefined,
      },
      {
        onSuccess: () => {
          // Reset state
          setNotes("");
          setConfidence(80);
          setShowNotes(false);

          // Refetch to get updated queue
          refetch();
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to submit decision");
        },
      }
    );
  }, [currentStudy, currentProjectId, currentPhase, submitDecision, getDecisionTime, refetch, confidence, notes]);

  // Handle confirmed exclusion with reason
  const handleConfirmExclusion = useCallback((exclusionReason: string) => {
    if (!pendingExclusionStudyId || !currentProjectId) return;

    const timeSpentMs = getDecisionTime();
    const study = studies.find(s => s.id === pendingExclusionStudyId);

    submitDecision.mutate(
      {
        projectWorkId: pendingExclusionStudyId,
        phase: currentPhase,
        decision: "EXCLUDE" as ScreeningDecision,
        exclusionReason: exclusionReason,
        confidence: confidence,
        reasoning: notes,
        timeSpentMs: timeSpentMs || undefined,
        followedAi: study?.aiSuggestion ? "EXCLUDE" === study.aiSuggestion : undefined,
      },
      {
        onSuccess: () => {
          // Reset all state
          setShowExclusionModal(false);
          setPendingExclusionStudyId(null);
          setNotes("");
          setConfidence(80);
          setShowNotes(false);

          toast.success("Study excluded successfully");

          // Refetch to get updated queue
          refetch();
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to exclude study");
        },
      }
    );
  }, [pendingExclusionStudyId, currentProjectId, currentPhase, submitDecision, getDecisionTime, refetch, confidence, notes, studies]);

  const handleSwipe = useCallback((direction: "left" | "right" | "up") => {
    if (direction === "left") handleDecision("EXCLUDE");
    if (direction === "right") handleDecision("INCLUDE");
    if (direction === "up") handleDecision("MAYBE");
  }, [handleDecision]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (!currentStudy) return;

      const actions: Record<string, () => void> = {
        'i': () => handleDecision('INCLUDE'),
        'e': () => handleDecision('EXCLUDE'),
        'm': () => handleDecision('MAYBE'),
        'n': next,
        'arrowright': next,
        'p': previous,
        'arrowleft': previous,
        'f': toggleFocusMode,
        'c': () => setShowCriteria(!showCriteria),
      };

      if (actions[key]) {
        e.preventDefault();
        actions[key]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStudy, handleDecision, next, previous, toggleFocusMode]);

  // Loading state
  if (isLoading) {
    return (
      <div className="py-40 text-center space-y-8">
        <Loader2 className="w-12 h-12 animate-spin mx-auto text-muted" />
        <p className="text-muted font-serif italic text-xl">Loading screening queue...</p>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="py-40 text-center space-y-8">
        <AlertCircle className="w-12 h-12 mx-auto text-rose-500" />
        <div className="space-y-3">
          <h2 className="text-3xl font-serif text-ink">Unable to load queue</h2>
          <p className="text-muted font-serif italic text-lg max-w-md mx-auto">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-editorial inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }



  // Empty state logic
  if (!currentStudy || totalStudies === 0) {
    if (isLoadingNextSteps) {
      return (
        <div className="py-40 text-center space-y-8">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-muted" />
          <p className="text-muted font-serif italic text-xl">Analyzing workflow status...</p>
        </div>
      );
    }

    return (
      <ScreeningStats
        currentPhase={currentPhase}
        projectStats={projectStats}
        enabledPhases={enabledPhases}
        stats={{
          completed: nextSteps?.completed || false,
          totalPending: nextSteps?.totalPending || 0,
          conflicts: nextSteps?.conflicts || 0,
          remainingReviewers: nextSteps?.remainingReviewers || 0,
          phaseStats: {
            total: nextSteps?.phaseStats?.total || 0,
            included: nextSteps?.phaseStats?.included || 0,
            excluded: nextSteps?.phaseStats?.excluded || 0,
            maybe: nextSteps?.phaseStats?.maybe || 0
          },
          canMoveToNextPhase: !!nextSteps?.canMoveToNextPhase,
          nextPhase: nextSteps?.nextPhase as "TITLE_ABSTRACT" | "FULL_TEXT" | "FINAL" | undefined
        }}
        onRefresh={() => refetch()}
        onPhaseChange={setCurrentPhase}
        onResolveConflicts={() => {
          if (currentProjectId) {
            router.push(`/project/${currentProjectId}/conflicts`);
          }
        }}
        onMoveToNextPhase={() => {
          if (nextSteps?.nextPhase && currentProjectId) {
            advancePhase.mutate(
              { currentPhase },
              {
                onSuccess: (result) => {
                  toast.success(`Advanced ${result.advancedCount} studies to ${result.toPhase}`);
                  refetch();
                },
                onError: (error) => {
                  toast.error(error instanceof Error ? error.message : "Failed to advance phase");
                },
              }
            );
          }
        }}
      />
    );
  }

  const progress = ((currentIndex + 1) / totalStudies) * 100;
  const authorsDisplay = currentStudy.authors.map(a => a.name).join(", ");




  return (
    <div className={cn(
      "flex flex-col h-full transition-all duration-700 ease-in-out",
      isFocused ? "fixed inset-0 bg-paper z-[100] p-12 overflow-hidden" : "space-y-6 lg:space-y-12"
    )}>
      {/* Header */}
      <header className={cn(
        "flex justify-between items-center transition-all duration-500",
        isFocused ? "max-w-7xl mx-auto w-full mb-12" : "",
        // On mobile, compact the header
        isMobile ? "flex-col items-start gap-4" : ""
      )}>
        <div className="flex items-center gap-10 w-full justify-between lg:justify-start">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted font-bold hidden sm:inline">Phase:</span>
              <PhaseSelector
                currentPhase={currentPhase}
                onPhaseChange={setCurrentPhase}
                enabledPhases={enabledPhases}
                className="w-full max-w-[260px] lg:w-80"
              />
            </div>
            <div className="h-4 w-[1px] bg-border" />
            <span className="font-mono text-[10px] font-bold tracking-widest text-ink">{currentIndex + 1} / {totalStudies}</span>
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
            <span className="font-mono text-[9px] uppercase text-muted tracking-widest">{Math.round(progress)}%</span>
          </div>
        </div>

        <div className={cn("flex items-center gap-4", isMobile && "hidden")}>
          <ToolbarButton
            onClick={toggleFocusMode}
            icon={isFocused ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            label={isFocused ? "Exit Focus" : "Focus Mode (F)"}
          />
          {isFocused && criteria && (
            <ToolbarButton
              onClick={() => {
                setShowCriteria(!showCriteria);
                if (!showCriteria) setShowChat(false);
              }}
              icon={<Info className="w-5 h-5" />}
              label={showCriteria ? "Hide Criteria (C)" : "Show Criteria (C)"}
            />
          )}
          <ToolbarButton
            onClick={() => setIsBatchMode(!isBatchMode)}
            icon={isBatchMode ? <X className="w-5 h-5" /> : <Loader2 className="w-5 h-5 rotate-45" />}
            label={isBatchMode ? "Exit Batch" : "Batch Mode"}
          />
          {!isFocused && !isBatchMode && (
            <>
              <ToolbarButton icon={<History className="w-5 h-5" />} label="History" />
              <ToolbarButton icon={<Keyboard className="w-5 h-5" />} label="Shortcuts" />
            </>
          )}
        </div>
      </header>

      {/* Filtering and Sorting - Only show when not in focus mode or batch mode */}
      {!isFocused && !isBatchMode && (
        <ScreeningFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          sortBy={sortBy}
          onSortChange={setSortBy}
          filterDecision={filterDecision}
          onFilterDecisionChange={setFilterDecision}
          onClearFilters={() => {
            setSearchTerm("");
            setSortBy("aiConfidence");
            setFilterDecision(undefined);
          }}
        />
      )}

      {/* Main Screening Area */}
      <div className={cn(
        "flex-1 grid gap-20",
        isFocused
          ? showCriteria
            ? "grid-cols-12 max-w-7xl mx-auto w-full"
            : "grid-cols-1 max-w-5xl mx-auto w-full"
          : "grid-cols-1"
      )}>
        {/* Batch Mode View */}
        {isBatchMode ? (
          <div className="max-w-7xl mx-auto w-full space-y-4">
            <div className="flex justify-between items-center bg-white p-4 border border-border rounded-sm">
              <div className="flex items-center gap-4">
                <h3 className="font-serif italic text-lg text-ink">Batch Selection</h3>
                <div className="h-4 w-[1px] bg-border" />
                <span className="font-mono text-xs uppercase tracking-widest text-muted">
                  {selectedIds.length} Selected
                </span>
              </div>
              <Button
                onClick={() => setShowBatchPanel(true)}
                disabled={selectedIds.length === 0}
                className="bg-ink text-paper hover:bg-ink/90 font-mono uppercase tracking-widest text-xs"
              >
                <Sparkles className="w-3 h-3 mr-2" />
                Batch Actions
              </Button>
            </div>

            <div className="bg-white border border-border rounded-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={studies.length > 0 && selectedIds.length === studies.length}
                        onChange={toggleSelectAll}
                        className="rounded-sm border-border"
                      />
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Authors</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AI Suggestion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studies.map((study) => (
                    <TableRow key={study.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(study.id)}
                          onChange={() => toggleSelection(study.id)}
                          className="rounded-sm border-border"
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-lg truncate" title={study.title}>
                        {study.title}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {study.authors.map(a => a.name).join(", ")}
                      </TableCell>
                      <TableCell>{study.year || "-"}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-widest",
                          study.userDecision === "INCLUDE" ? "bg-emerald-100 text-emerald-700" :
                            study.userDecision === "EXCLUDE" ? "bg-rose-100 text-rose-700" :
                              study.userDecision === "MAYBE" ? "bg-slate-100 text-slate-700" :
                                "bg-gray-50 text-gray-400"
                        )}>
                          {study.userDecision || "Pending"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {study.aiSuggestion && (
                          <div className="flex items-center gap-1 text-xs font-mono text-intel-blue">
                            <Sparkles className="w-3 h-3" />
                            {study.aiSuggestion} ({Math.round((study.aiConfidence || 0) * 100)}%)
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <>
            {/* Study Content */}
            <div className={cn(
              "space-y-16 overflow-y-auto scroll-smooth pr-6 scrollbar-hide",
              isFocused
                ? showCriteria
                  ? "col-span-8 pr-20"
                  : "col-span-full"
                : "max-w-4xl"
            )}>
              <SwipeableCard onSwipe={handleSwipe} disabled={!isMobile}>
                <AnimatePresence mode="wait">
                  <motion.article
                    key={currentStudy.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-16"
                  >
                    <div className="space-y-8">
                      {/* Dual Screening Status */}
                      {currentStudy.reviewerStatus && (
                        <DualScreeningStatus
                          reviewerStatus={currentStudy.reviewerStatus}
                          votedReviewers={currentStudy.votedReviewers}
                          totalReviewersNeeded={currentStudy.totalReviewersNeeded}
                          reviewersVoted={currentStudy.reviewersVoted}
                        />
                      )}

                      <h2 className="text-3xl md:text-5xl lg:text-7xl font-serif leading-[1.05] tracking-tight text-ink decoration-intel-blue/20 underline-offset-8">
                        <KeywordHighlighter
                          text={currentStudy.title}
                          keywords={project?.highlightKeywords || []}
                        />
                      </h2>
                      <div className="flex flex-wrap items-center gap-8 text-[11px] font-mono uppercase tracking-[0.25em] text-muted">
                        <span className="font-bold text-ink/80">{authorsDisplay}</span>
                        {currentStudy.journal && (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-intel-blue/40" />
                            <span className="italic">{currentStudy.journal}</span>
                          </>
                        )}
                        {currentStudy.year && (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-intel-blue/40" />
                            <span>{currentStudy.year}</span>
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
                          onClick={() => {
                            setShowChat(true);
                            setShowCriteria(false);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-intel-blue/5 hover:bg-intel-blue/10 border border-intel-blue/20 rounded-full transition-colors text-intel-blue group"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Ask AI</span>
                        </button>
                      </div>
                      <p className="text-lg md:text-2xl lg:text-3xl font-serif leading-[1.55] italic text-ink/90 first-letter:text-5xl md:first-letter:text-8xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-ink first-letter:leading-none select-text">
                        <KeywordHighlighter
                          text={currentStudy.abstract || "No abstract available."}
                          keywords={project?.highlightKeywords || []}
                        />
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-6 pt-12">
                      {currentStudy.aiSuggestion && currentStudy.aiConfidence && (
                        <MetadataBadge
                          icon={<Sparkles className="w-3.5 h-3.5 text-intel-blue animate-pulse" />}
                          label={`AI Prediction: ${currentStudy.aiSuggestion} (${Math.round(currentStudy.aiConfidence * 100)}%)`}
                          variant="intel"
                        />
                      )}
                      {currentStudy.doi && (
                        <MetadataBadge
                          icon={<Info className="w-3.5 h-3.5" />}
                          label={`DOI: ${currentStudy.doi}`}
                        />
                      )}

                      <FullTextControls
                        projectId={currentProjectId!}
                        projectWorkId={currentStudy.id}
                        workUrl={currentStudy.url}
                        doi={currentStudy.doi}
                        title={currentStudy.title}
                        pdfR2Key={currentStudy.pdfR2Key}
                        ingestionStatus={currentStudy.ingestionStatus}
                        ingestionError={currentStudy.ingestionError}
                        chunksCreated={currentStudy.chunksCreated}
                        onChanged={refetch}
                      />
                    </div>

                    {/* Study Tags */}
                    <div className="pt-8 border-t border-border/30">
                      <StudyTags
                        projectId={currentProjectId!}
                        projectWorkId={currentStudy.id}
                        tags={currentStudy.tags || []}
                        onUpdate={refetch}
                        editable={true}
                      />
                    </div>
                  </motion.article>
                </AnimatePresence>
              </SwipeableCard>
            </div>

            {/* Right Sidebar (Focus Mode) */}
            {isFocused && (showCriteria || showChat) && (
              <div className="col-span-4 border-l border-border/50 pl-8 overflow-y-auto h-[calc(100vh-10rem)] sticky top-24">
                {showChat ? (
                  <div className="h-full flex flex-col bg-white/50 rounded-sm">
                    <div className="flex justify-between items-center mb-6 pt-1">
                      <div className="flex items-center gap-2 text-intel-blue">
                        <Sparkles className="w-4 h-4" />
                        <h3 className="font-mono text-[10px] uppercase tracking-[0.25em] font-black">AI Assistant</h3>
                      </div>
                      <button onClick={() => setShowChat(false)} className="hover:bg-slate-100 p-1 rounded-sm text-muted hover:text-ink transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <ChatInterface
                      projectId={currentProjectId!}
                      initialMessages={[
                        {
                          id: 'context',
                          role: 'system',
                          content: `You are an expert research assistant helping to screen this study for a systematic review.\n\nStudy Context:\nTitle: ${currentStudy.title}\nAuthors: ${currentStudy.authors.map(a => a.name).join(", ")}\nAbstract: ${currentStudy.abstract}\n\nAnswer questions about this specific study based on the provided title and abstract. If the question requires external knowledge, you may use it, but prioritize the study context.`
                        } as any
                      ]}
                      className="flex-1 min-h-0"
                    />
                  </div>
                ) : (
                  <EligibilityCriteriaPanel
                    criteria={criteria}
                    collapsible={false}
                  />
                )}
              </div>
            )}

            {/* Action Panel (Focused Mode Sidebar) */}
            {!isBatchMode && (
              isFocused ? (
                <div className="col-span-4 border-l border-border/50 pl-20 flex flex-col justify-center space-y-20">
                  <div className="space-y-12">
                    <h3 className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted font-black">Adjudication</h3>
                    <div className="space-y-6">
                      <DecisionButton
                        label="Include"
                        shortcut="I"
                        icon={<Check className="w-8 h-8" />}
                        color="green"
                        active={currentStudy.userDecision === 'INCLUDE'}
                        loading={submitDecision.isPending}
                        onClick={() => handleDecision('INCLUDE')}
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

                      {/* Exclude Button - Opens Modal */}
                      <DecisionButton
                        label="Exclude"
                        shortcut="E"
                        icon={<X className="w-8 h-8" />}
                        color="red"
                        active={currentStudy.userDecision === 'EXCLUDE'}
                        loading={submitDecision.isPending}
                        onClick={() => handleDecision('EXCLUDE')}
                      />

                      <DecisionButton
                        label="Maybe"
                        shortcut="M"
                        icon={<HelpCircle className="w-8 h-8" />}
                        color="muted"
                        active={currentStudy.userDecision === 'MAYBE'}
                        loading={submitDecision.isPending}
                        onClick={() => handleDecision('MAYBE')}
                      />
                    </div>
                  </div>

                  <div className="pt-20 border-t border-border/30 space-y-8">
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.2em] text-muted">
                      <span>Navigate Workspace</span>
                      <div className="flex gap-4">
                        <button
                          onClick={previous}
                          disabled={currentIndex === 0}
                          className="p-3 hover:bg-white border border-border/60 hover:border-ink rounded-sm transition-all shadow-sm disabled:opacity-50"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={next}
                          disabled={currentIndex >= totalStudies - 1}
                          className="p-3 hover:bg-white border border-border/60 hover:border-ink rounded-sm transition-all shadow-sm disabled:opacity-50"
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
              ) : null
            )}
          </>
        )}
      </div>

      {/* Footer Decisions (Normal Mode) */}
      {!isFocused && !isBatchMode && (
        <footer className={cn(
          "fixed z-[60] animate-in fade-in slide-in-from-bottom-4 duration-700 bg-white/95 backdrop-blur-xl border border-border shadow-editorial flex justify-between items-center",
          // Desktop: Floating bottom right
          "md:bottom-12 md:right-12 md:left-auto md:w-auto md:p-8 md:rounded-sm md:gap-8",
          // Mobile: Fixed bottom full width
          "bottom-0 left-0 right-0 w-full py-3 px-14 gap-2 md:p-4 md:gap-4 rounded-t-xl border-x-0 border-b-0"
        )}>
          <div className="flex items-center gap-6 md:border-r md:border-border md:pr-8 hidden md:flex">
            <button
              onClick={previous}
              disabled={currentIndex === 0}
              className="p-2.5 hover:bg-paper rounded-full transition-all text-muted hover:text-ink border border-transparent hover:border-border disabled:opacity-50"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="text-center min-w-[60px] hidden md:block">
              <div className="font-mono text-xs font-bold text-ink">{currentIndex + 1}</div>
              <div className="font-mono text-[8px] uppercase tracking-tighter text-muted">of {totalStudies}</div>
            </div>
            <button
              onClick={next}
              disabled={currentIndex >= totalStudies - 1}
              className="p-2.5 hover:bg-paper rounded-full transition-all text-muted hover:text-ink border border-transparent hover:border-border disabled:opacity-50"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
          <div className="flex gap-2 md:gap-4 items-center flex-1 w-full md:w-auto justify-between md:justify-end">
            <div className="hidden md:flex gap-4 items-center mr-4">
              <ConfidenceSlider
                value={confidence}
                onChange={setConfidence}
                className="w-32"
              />
            </div>

            <DecisionButtonSmall
              label="Exclude"
              color="red"
              active={currentStudy.userDecision === 'EXCLUDE'}
              loading={submitDecision.isPending}
              onClick={() => handleDecision('EXCLUDE')}
            />
            <DecisionButtonSmall
              label="Maybe"
              color="muted"
              active={currentStudy.userDecision === 'MAYBE'}
              loading={submitDecision.isPending}
              onClick={() => handleDecision('MAYBE')}
            />
            <DecisionButtonSmall
              label="Include"
              color="green"
              active={currentStudy.userDecision === 'INCLUDE'}
              loading={submitDecision.isPending}
              onClick={() => handleDecision('INCLUDE')}
            />
          </div>
        </footer>
      )}

      {currentProjectId && (
        <LeadOperationsPanel
          projectId={currentProjectId}
          isOpen={showBatchPanel}
          onClose={() => setShowBatchPanel(false)}
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds([])}
          currentPhase={currentPhase as any}
        />
      )}

      {/* Global Exclusion Reason Modal - Works from all entry points */}
      <ExclusionReasonModal
        isOpen={showExclusionModal}
        onClose={() => {
          setShowExclusionModal(false);
          setPendingExclusionStudyId(null);
        }}
        onConfirm={handleConfirmExclusion}
        studyTitle={studies.find(s => s.id === pendingExclusionStudyId)?.title}
        isSubmitting={submitDecision.isPending}
      />
    </div>
  );
}

function ToolbarButton({ icon, onClick, label }: { icon: React.ReactNode, onClick?: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className="p-3 hover:bg-white rounded-full transition-all border border-transparent hover:border-border hover:shadow-sm group relative"
    >
      {icon}
      <span className="absolute bottom-full right-0 mb-2 whitespace-nowrap bg-ink text-paper text-[9px] font-mono uppercase px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {label}
      </span>
    </button>
  );
}

function MetadataBadge({ icon, label, variant = 'default' }: { icon: React.ReactNode, label: string, variant?: 'default' | 'intel' }) {
  return (
    <div className={cn(
      "px-5 py-2.5 border text-[11px] font-mono uppercase tracking-widest rounded-full flex items-center gap-3 transition-all",
      variant === 'intel'
        ? "bg-intel-blue/5 border-intel-blue/30 text-intel-blue shadow-sm"
        : "bg-white border-border text-muted hover:border-ink hover:text-ink"
    )}>
      {icon}
      {label}
    </div>
  );
}

function DecisionButton({ label, shortcut, icon, color, active, loading, onClick }: {
  label: string,
  shortcut: string,
  icon: React.ReactNode,
  color: 'green' | 'red' | 'muted',
  active: boolean,
  loading?: boolean,
  onClick: () => void
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
      className={cn(
        "w-full flex items-center justify-between p-10 border transition-all duration-500 group rounded-sm outline-none disabled:opacity-50",
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
        <span className="text-5xl font-serif italic tracking-tighter transition-all group-hover:translate-x-2">{label}</span>
      </div>
      <kbd className="hidden group-hover:block font-mono text-[10px] opacity-20 tracking-[0.3em] font-black">{shortcut}</kbd>
    </button>
  );
}

function DecisionButtonSmall({ label, color, active, loading, onClick }: {
  label: string,
  color: 'green' | 'red' | 'muted',
  active: boolean,
  loading?: boolean,
  onClick: () => void
}) {
  const colors = {
    green: "text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300",
    red: "text-rose-700 hover:bg-rose-50 hover:border-rose-300",
    muted: "text-muted hover:bg-paper hover:border-border"
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex-1 md:flex-none px-2 py-3 md:px-10 md:py-4 border border-border/40 font-serif italic text-sm md:text-xl transition-all rounded-sm disabled:opacity-50 whitespace-nowrap",
        active ? "bg-ink text-paper border-ink shadow-editorial translate-y-[-4px]" : colors[color]
      )}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : label}
    </button>
  );
}
