"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useScreeningStore } from "@/stores/screening-store";
import {
  useScreeningQueue,
  useSubmitDecision,
  useScreeningNextSteps as useScreeningQueueNextSteps,
  useAdvancePhase,
} from "@/features/screening/api/queries";
import { useProject, useProjectStats } from "@/features/projects/api/queries";
import { useAppStore } from "@/stores/app-store";
import type {
  ScreeningDecision,
  ScreeningQueueItem,
  ScreeningPhase,
} from "@/lib/api-client";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExclusionReasonModal } from "./ExclusionReasonModal";
import { toast } from "sonner";
import { ConfidenceSlider } from "./ConfidenceSlider";
import { ScreeningStats } from "./ScreeningStats";
import { LeadOperationsPanel } from "./LeadOperationsPanel";
import { ScreeningFilters } from "./ScreeningFilters";
import { EligibilityCriteriaPanel } from "./EligibilityCriteriaPanel";
import { ChatInterface } from "@/features/ai/components/ChatInterface";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ScreeningHeader } from "./ScreeningHeader";
import { ScreeningBatchView } from "./ScreeningBatchView";
import { ScreeningStudyCard } from "./ScreeningStudyCard";
import { ScreeningDecisionControls } from "./ScreeningDecisionControls";

// Small decision button for footer - kept here as its very specific to footer
function DecisionButtonSmall({
  label,
  color,
  active,
  loading,
  onClick,
}: {
  label: string;
  color: "green" | "red" | "muted";
  active: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  const colors = {
    green: "text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300",
    red: "text-rose-700 hover:bg-rose-50 hover:border-rose-300",
    muted: "text-muted hover:bg-paper hover:border-border",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex-1 md:flex-none px-2 py-3 md:px-10 md:py-4 border border-border/40 font-serif italic text-sm md:text-xl transition-all rounded-sm disabled:opacity-50 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2",
        active
          ? "bg-ink text-paper border-ink shadow-editorial translate-y-[-4px]"
          : colors[color]
      )}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : label}
    </button>
  );
}

export function ScreeningQueue() {
  const router = useRouter();
  const { currentProjectId } = useAppStore();
  const isMobile = useIsMobile();

  // View density preference (default: comfortable, forced to compact on mobile)
  const [viewDensityPreference, setViewDensityPreference] = useLocalStorage<
    "comfortable" | "compact"
  >("screening-view-density", "comfortable");
  const viewDensity = isMobile ? "compact" : viewDensityPreference;

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
  const [pendingExclusionStudyId, setPendingExclusionStudyId] = useState<
    string | null
  >(null);
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
  const [filterDecision, setFilterDecision] = useState<string | undefined>(
    undefined
  );

  // Eligibility Criteria Panel State
  const [showCriteria, setShowCriteria] = useState(false);
  const [criteria, setCriteria] = useState<any>(null);

  // Fetch screening queue from API
  const { data, isLoading, isError, error, refetch } = useScreeningQueue(
    currentProjectId || undefined,
    {
      phase: currentPhase,
      limit: 100,
      search: searchTerm || undefined,
      sortBy: sortBy,
      status: filterDecision,
    }
  );

  // Submit decision mutation
  const submitDecision = useSubmitDecision(currentProjectId || "");

  // Move hooks to top level
  const { data: nextSteps, isLoading: isLoadingNextSteps } =
    useScreeningQueueNextSteps(currentProjectId || undefined, currentPhase);
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
  }, [
    projectStats?.phaseTotals?.titleAbstract,
    projectStats?.phaseTotals?.fullText,
    projectStats?.phaseTotals?.final,
    currentPhase,
  ]);

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
      setSelectedIds(studies.map((s) => s.id));
    }
  }, [studies, selectedIds]);

  // Handle single selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  // Handle decision - opens modal for EXCLUDE, submits directly for others
  const handleDecision = useCallback(
    (decision: ScreeningDecision | "MAYBE") => {
      if (!currentStudy || !currentProjectId) return;

      // For EXCLUDE, always show the modal to get a reason
      if (decision === "EXCLUDE") {
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
          followedAi: currentStudy.aiSuggestion
            ? decision === currentStudy.aiSuggestion
            : undefined,
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
            toast.error(
              error instanceof Error ? error.message : "Failed to submit decision"
            );
          },
        }
      );
    },
    [
      currentStudy,
      currentProjectId,
      currentPhase,
      submitDecision,
      getDecisionTime,
      refetch,
      confidence,
      notes,
    ]
  );

  // Handle confirmed exclusion with reason
  const handleConfirmExclusion = useCallback(
    (exclusionReason: string) => {
      if (!pendingExclusionStudyId || !currentProjectId) return;

      const timeSpentMs = getDecisionTime();
      const study = studies.find((s) => s.id === pendingExclusionStudyId);

      submitDecision.mutate(
        {
          projectWorkId: pendingExclusionStudyId,
          phase: currentPhase,
          decision: "EXCLUDE" as ScreeningDecision,
          exclusionReason: exclusionReason,
          confidence: confidence,
          reasoning: notes,
          timeSpentMs: timeSpentMs || undefined,
          followedAi: study?.aiSuggestion
            ? "EXCLUDE" === study.aiSuggestion
            : undefined,
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
            toast.error(
              error instanceof Error ? error.message : "Failed to exclude study"
            );
          },
        }
      );
    },
    [
      pendingExclusionStudyId,
      currentProjectId,
      currentPhase,
      submitDecision,
      getDecisionTime,
      refetch,
      confidence,
      notes,
      studies,
    ]
  );

  const handleSwipe = useCallback(
    (direction: "left" | "right" | "up") => {
      if (direction === "left") handleDecision("EXCLUDE");
      if (direction === "right") handleDecision("INCLUDE");
      if (direction === "up") handleDecision("MAYBE");
    },
    [handleDecision]
  );

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const key = e.key.toLowerCase();
      if (!currentStudy) return;

      const actions: Record<string, () => void> = {
        i: () => handleDecision("INCLUDE"),
        e: () => handleDecision("EXCLUDE"),
        m: () => handleDecision("MAYBE"),
        n: next,
        arrowright: next,
        p: previous,
        arrowleft: previous,
        f: toggleFocusMode,
        c: () => setShowCriteria(!showCriteria),
      };

      if (actions[key]) {
        e.preventDefault();
        actions[key]();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStudy, handleDecision, next, previous, toggleFocusMode, showCriteria]);

  // Loading state
  if (isLoading) {
    return (
      <div className="py-40 text-center space-y-8">
        <Loader2 className="w-12 h-12 animate-spin mx-auto text-muted" />
        <p className="text-muted font-serif italic text-xl">
          Loading screening queue...
        </p>
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
          <p className="text-muted font-serif italic text-xl">
            Analyzing workflow status...
          </p>
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
            maybe: nextSteps?.phaseStats?.maybe || 0,
          },
          userStats: {
            total: nextSteps?.userStats?.total || 0,
            included: nextSteps?.userStats?.included || 0,
            excluded: nextSteps?.userStats?.excluded || 0,
            pending: nextSteps?.userStats?.pending || 0,
            maybe: nextSteps?.userStats?.maybe || 0,
          },
          canMoveToNextPhase: !!nextSteps?.canMoveToNextPhase,
          nextPhase: nextSteps?.nextPhase as
            | "TITLE_ABSTRACT"
            | "FULL_TEXT"
            | "FINAL"
            | undefined,
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
                  toast.success(
                    `Advanced ${result.advancedCount} studies to ${result.toPhase}`
                  );
                  refetch();
                },
                onError: (error) => {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Failed to advance phase"
                  );
                },
              }
            );
          }
        }}
      />
    );
  }

  const progress = ((currentIndex + 1) / totalStudies) * 100;

  return (
    <div
      className={cn(
        "flex flex-col h-full transition-all duration-700 ease-in-out",
        isFocused
          ? "fixed inset-0 bg-paper z-[100] p-12 overflow-y-auto"
          : "space-y-6 lg:space-y-12"
      )}
    >
      <ScreeningHeader
        currentIndex={currentIndex}
        totalStudies={totalStudies}
        currentPhase={currentPhase}
        enabledPhases={enabledPhases}
        onPhaseChange={setCurrentPhase}
        progress={progress}
        isFocused={isFocused}
        toggleFocusMode={toggleFocusMode}
        isMobile={isMobile}
        viewDensity={viewDensity}
        onToggleViewDensity={() =>
          setViewDensityPreference(
            viewDensityPreference === "comfortable" ? "compact" : "comfortable"
          )
        }
        showCriteria={showCriteria}
        onToggleCriteria={() => {
          setShowCriteria(!showCriteria);
          if (!showCriteria) setShowChat(false);
        }}
        isBatchMode={isBatchMode}
        onToggleBatchMode={() => setIsBatchMode(!isBatchMode)}
        hasCriteria={!!criteria}
      />

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
      <div
        className={cn(
          "flex-1 grid gap-20",
          isFocused
            ? showCriteria
              ? "grid-cols-12 max-w-7xl mx-auto w-full"
              : "grid-cols-1 max-w-5xl mx-auto w-full"
            : "grid-cols-1"
        )}
      >
        {/* Batch Mode View */}
        {isBatchMode ? (
          <ScreeningBatchView
            studies={studies}
            selectedIds={selectedIds}
            onSelectAll={toggleSelectAll}
            onSelect={toggleSelection}
            onOpenBatchPanel={() => setShowBatchPanel(true)}
          />
        ) : (
          <>
            {/* Study Content */}
            <div
              className={cn(
                "space-y-16 overflow-y-auto scroll-smooth pr-6 scrollbar-hide",
                isFocused
                  ? showCriteria
                    ? "col-span-8 pr-20"
                    : "col-span-full"
                  : "max-w-4xl"
              )}
            >
              <ScreeningStudyCard
                study={currentStudy}
                projectId={currentProjectId!}
                viewDensity={viewDensity}
                isMobile={isMobile}
                keywords={project?.highlightKeywords || []}
                onSwipe={handleSwipe}
                onAskAI={() => {
                  setShowChat(true);
                  setShowCriteria(false);
                }}
                onUpdate={refetch}
              />
            </div>

            {/* Right Sidebar (Focus Mode) */}
            {isFocused && (showCriteria || showChat) && (
              <div className="col-span-4 border-l border-border/50 pl-8 overflow-y-auto h-[calc(100vh-10rem)] sticky top-24">
                {showChat ? (
                  <div className="h-full flex flex-col bg-white/50 rounded-sm">
                    <div className="flex justify-between items-center mb-6 pt-1">
                      <div className="flex items-center gap-2 text-intel-blue">
                        <Sparkles className="w-4 h-4" />
                        <h3 className="font-mono text-[10px] uppercase tracking-[0.25em] font-black">
                          AI Assistant
                        </h3>
                      </div>
                      <button
                        onClick={() => setShowChat(false)}
                        className="hover:bg-slate-100 p-1 rounded-sm text-muted hover:text-ink transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <ChatInterface
                      projectId={currentProjectId!}
                      initialMessages={[
                        {
                          id: "context",
                          role: "system",
                          content: `You are an expert research assistant helping to screen this study for a systematic review.\n\nStudy Context:\nTitle: ${currentStudy.title
                            }\nAuthors: ${currentStudy.authors
                              .map((a) => a.name)
                              .join(", ")}\nAbstract: ${currentStudy.abstract
                            }\n\nAnswer questions about this specific study based on the provided title and abstract. If the question requires external knowledge, you may use it, but prioritize the study context.`,
                        } as any,
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
            {!isBatchMode &&
              isFocused &&
              (
                <ScreeningDecisionControls
                  onDecision={handleDecision}
                  currentDecision={currentStudy.userDecision as ScreeningDecision | null}
                  isPending={submitDecision.isPending}
                  viewDensity={viewDensity}
                  confidence={confidence}
                  setConfidence={setConfidence}
                  notes={notes}
                  setNotes={setNotes}
                  showNotes={showNotes}
                  setShowNotes={setShowNotes}
                  onNext={next}
                  onPrevious={previous}
                  canGoNext={currentIndex < totalStudies - 1}
                  canGoPrevious={currentIndex > 0}
                />
              )}
          </>
        )}
      </div>

      {/* Footer Decisions (Normal Mode) */}
      {!isFocused && !isBatchMode && (
        <footer
          className={cn(
            "fixed z-[60] animate-in fade-in slide-in-from-bottom-4 duration-700 bg-white/95 backdrop-blur-xl border border-border shadow-editorial flex justify-between items-center",
            // Desktop: Floating bottom right
            "md:bottom-12 md:right-12 md:left-auto md:w-auto md:p-8 md:rounded-sm md:gap-8",
            // Mobile: Fixed bottom full width
            "bottom-0 left-0 right-0 w-full py-3 px-14 gap-2 md:p-4 md:gap-4 rounded-t-xl border-x-0 border-b-0"
          )}
        >
          <div className="flex items-center gap-6 md:border-r md:border-border md:pr-8 hidden md:flex">
            <button
              onClick={previous}
              disabled={currentIndex === 0}
              aria-label="Previous Study"
              className="p-2.5 hover:bg-paper rounded-full transition-all text-muted hover:text-ink border border-transparent hover:border-border disabled:opacity-50"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="text-center min-w-[60px] hidden md:block">
              <div className="font-mono text-xs font-bold text-ink">
                {currentIndex + 1}
              </div>
              <div className="font-mono text-[8px] uppercase tracking-tighter text-muted">
                of {totalStudies}
              </div>
            </div>
            <button
              onClick={next}
              disabled={currentIndex >= totalStudies - 1}
              aria-label="Next Study"
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
              active={currentStudy.userDecision === "EXCLUDE"}
              loading={submitDecision.isPending}
              onClick={() => handleDecision("EXCLUDE")}
            />
            <DecisionButtonSmall
              label="Maybe"
              color="muted"
              active={currentStudy.userDecision === "MAYBE"}
              loading={submitDecision.isPending}
              onClick={() => handleDecision("MAYBE")}
            />
            <DecisionButtonSmall
              label="Include"
              color="green"
              active={currentStudy.userDecision === "INCLUDE"}
              loading={submitDecision.isPending}
              onClick={() => handleDecision("INCLUDE")}
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
        studyTitle={studies.find((s) => s.id === pendingExclusionStudyId)?.title}
        isSubmitting={submitDecision.isPending}
      />
    </div>
  );
}
