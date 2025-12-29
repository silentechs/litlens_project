"use client";

import { useState } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  HelpCircle,
  AlertCircle,
  Info,
  ChevronRight,
  Sparkles,
  BarChart3,
  Layers,
  ArrowRight,
  FileText,
  Loader2,
  ArrowLeft,
  Save
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQualityQueue, useQualitySummary, useQualityTools, useSaveAssessment } from "../api/queries";
import { toast } from "sonner";

interface QualityAssessmentProps {
  projectId: string;
}

export function QualityAssessment({ projectId }: QualityAssessmentProps) {
  const [activeView, setActiveView] = useState<'dashboard' | 'assessment'>('dashboard');
  const [activeWorkId, setActiveWorkId] = useState<string | null>(null);

  // Queries
  const { data: queue, isLoading: isLoadingQueue } = useQualityQueue(projectId);
  const { data: summary, isLoading: isLoadingSummary } = useQualitySummary(projectId);
  const { data: tools, isLoading: isLoadingTools } = useQualityTools(projectId);

  // Helper to start assessment
  const handleStartAssessment = (workId: string) => {
    setActiveWorkId(workId);
    setActiveView('assessment');
  };

  if (activeView === 'assessment' && activeWorkId) {
    // Determine which tool to use. For now, pick the first active tool or fallback.
    const activeTool = tools?.[0];

    if (!activeTool) {
      return (
        <div className="py-24 text-center">
          <p className="text-muted">No quality assessment tools configured. Please ask a project lead to set up a tool (e.g. RoB 2.0).</p>
          <button
            onClick={() => setActiveView('dashboard')}
            className="mt-4 text-[10px] font-mono uppercase tracking-widest text-ink border-b border-ink"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    return (
      <AssessmentForm
        projectId={projectId}
        workId={activeWorkId}
        tool={activeTool}
        onBack={() => {
          setActiveView('dashboard');
          setActiveWorkId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Methodological Quality</h1>
          <p className="text-muted font-serif italic text-xl">Assessing risk of bias and certainty of evidence.</p>
        </div>
      </header>

      <div className="accent-line" />

      {isLoadingQueue ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted" />
          <p className="font-serif italic text-muted">Loading quality workspace...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Main Queue */}
          <main className="col-span-12 md:col-span-8 space-y-8">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Assessment Queue</h3>
              <span className="font-mono text-[10px] text-muted">Showing {queue?.length || 0} studies</span>
            </div>

            <div className="space-y-4">
              {queue?.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-border rounded-sm bg-paper/30">
                  <p className="font-serif italic text-muted">No studies ready for assessment.</p>
                  <p className="text-xs text-muted mt-2">Studies appear here after extraction is initiated.</p>
                </div>
              ) : (
                queue?.map((item: any) => (
                  <StudyCard
                    key={item.id}
                    item={item}
                    onStart={() => handleStartAssessment(item.id)}
                  />
                ))
              )}
            </div>
          </main>

          {/* Sidebar Stats */}
          <aside className="col-span-12 md:col-span-4 space-y-8">
            <div className="bg-ink text-paper p-8 space-y-8">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Risk Distribution</h3>
              {summary ? (
                <div className="space-y-6">
                  <BiasBar label="High Risk" value={summary.riskDistribution.HIGH} total={summary.assessedCount} color="bg-rose-500" />
                  <BiasBar label="Some Concerns" value={summary.riskDistribution.UNCLEAR} total={summary.assessedCount} color="bg-amber-500" />
                  <BiasBar label="Low Risk" value={summary.riskDistribution.LOW} total={summary.assessedCount} color="bg-emerald-500" />
                </div>
              ) : (
                <p className="text-xs text-paper/60 italic">No data yet.</p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function StudyCard({ item, onStart }: { item: any, onStart: () => void }) {
  return (
    <div className="group bg-white border border-border hover:border-ink transition-all p-6 flex justify-between items-center rounded-sm">
      <div className="flex items-center gap-6">
        <div className="w-10 h-10 border border-border flex items-center justify-center bg-paper text-muted group-hover:text-ink transition-colors">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-serif text-lg leading-tight group-hover:underline cursor-pointer">{item.study.title}</h4>
          <p className="text-xs text-muted mt-1">{item.study.authors} ({item.study.year})</p>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="text-right">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted">Status</p>
          <div className="flex items-center gap-2 justify-end">
            <div className={cn(
              "w-2 h-2 rounded-full",
              item.status === 'COMPLETED' ? "bg-emerald-500" : "bg-amber-500"
            )} />
            <span className="font-serif italic font-bold text-sm">{item.status}</span>
          </div>
        </div>

        <div className="text-right w-24">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted">Risk Level</p>
          <span className={cn(
            "font-bold text-sm",
            item.riskLevel === 'High Risk' ? "text-rose-600" :
              item.riskLevel === 'Low Risk' ? "text-emerald-600" : "text-amber-600"
          )}>
            {item.riskLevel || "N/A"}
          </span>
        </div>

        <button
          onClick={onStart}
          className="w-10 h-10 flex items-center justify-center border border-border hover:bg-ink hover:text-paper transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function BiasBar({ label, value, total, color }: { label: string, value: number, total: number, color: string }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-mono uppercase text-paper/60">
        <span>{label}</span>
        <span>{value} ({Math.round(percentage)}%)</span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Assessment Form Component (Inline for now)
// -------------------------------------------------------------

function AssessmentForm({ projectId, workId, tool, onBack }: { projectId: string; workId: string; tool: any; onBack: () => void }) {
  const { mutate: save, isPending } = useSaveAssessment(projectId);

  // In a real app, we would fetch existing assessment data here.
  // For now, we manage local state.
  const [domainScores, setDomainScores] = useState<Record<string, { score: string; justification: string }>>({});

  const handleScoreChange = (domainId: string, score: string) => {
    setDomainScores(prev => ({
      ...prev,
      [domainId]: { ...prev[domainId], score }
    }));
  };

  const handleJustificationChange = (domainId: string, justification: string) => {
    setDomainScores(prev => ({
      ...prev,
      [domainId]: { ...prev[domainId], justification }
    }));
  };

  const handleSave = () => {
    // Collect data
    save({
      projectWorkId: workId,
      toolId: tool.id,
      domainScores,
      complete: true, // Assuming save means complete for now
      autoCalculateOverall: true
    }, {
      onSuccess: () => {
        toast.success("Assessment saved successfully");
        onBack();
      },
      onError: () => {
        toast.error("Failed to save assessment");
      }
    });
  };

  return (
    <div className="space-y-8 pb-32">
      <header className="flex items-center justify-between border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 border border-border hover:bg-paper transition-all rounded-full">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div>
            <h2 className="text-2xl font-serif">Assessment: {tool.name}</h2>
            <p className="text-muted text-sm font-mono uppercase tracking-widest">Grading evidence quality</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="btn-editorial flex items-center gap-2"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Finalize Assessment
        </button>
      </header>

      <div className="space-y-12 max-w-5xl mx-auto">
        {tool.domains.map((domain: any) => (
          <div key={domain.id} className="bg-white border border-border p-8 space-y-6 rounded-sm shadow-sm">
            <div>
              <h3 className="text-xl font-serif font-bold italic">{domain.name}</h3>
              <p className="text-muted text-sm mt-1">{domain.description}</p>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">Risk Judgment</label>
              <div className="flex gap-4">
                {['Low Risk', 'Some Concerns', 'High Risk'].map((level) => (
                  <button
                    key={level}
                    onClick={() => handleScoreChange(domain.id, level)}
                    className={cn(
                      "px-4 py-2 border rounded-full text-sm font-medium transition-all",
                      domainScores[domain.id]?.score === level
                        ? "bg-ink text-paper border-ink"
                        : "border-border text-muted hover:border-ink hover:text-ink"
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">Justification / Support</label>
              <textarea
                value={domainScores[domain.id]?.justification || ''}
                onChange={(e) => handleJustificationChange(domain.id, e.target.value)}
                className="w-full bg-paper/30 border border-border/50 focus:border-ink p-4 text-sm font-serif italic outline-none transition-all rounded-sm resize-none"
                rows={3}
                placeholder="Explain why this judgment was made..."
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
