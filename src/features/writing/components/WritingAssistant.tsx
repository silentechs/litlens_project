"use client";

import { useState, useCallback } from "react";
import {
  Sparkles,
  FileText,
  ChevronRight,
  Send,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import RichTextEditor from "@/components/editor/RichTextEditor";

interface Draft {
  id: string;
  title: string;
  status: "draft" | "in-progress" | "final-review";
  content: string;
}

const INITIAL_DRAFTS: Draft[] = [
  {
    id: "1",
    title: "Literature Review: AI in Medicine",
    status: "in-progress",
    content: `<h1>The Evolution of Systematic Evidence Synthesis</h1>
<p>As the volume of scholarly publications continues to grow at an exponential rate, traditional methods of manual evidence synthesis are becoming increasingly untenable. The integration of large language models (LLMs) into the systematic review pipeline represents not just an incremental efficiency gain, but a fundamental paradigm shift in how knowledge is aggregated.</p>
<p>Marshall et al. (2024) have demonstrated that transformer-based architectures can achieve human-level sensitivity in title and abstract screening, though the risk of systemic bias remains a critical concern for methodology rigor.</p>`,
  },
  {
    id: "2",
    title: "Methodology: Systematic Synthesis",
    status: "draft",
    content: "<h1>Methodology</h1><p>Start writing your methodology section...</p>",
  },
  {
    id: "3",
    title: "Introduction: The Future of Reviews",
    status: "final-review",
    content: "<h1>Introduction</h1><p>The landscape of systematic reviews is changing rapidly...</p>",
  },
];

const CITATIONS = [
  { author: "Marshall et al.", year: 2024 },
  { author: "Zhu et al.", year: 2023 },
  { author: "Grant, R.", year: 2024 },
];

export function WritingAssistant() {
  const [drafts, setDrafts] = useState<Draft[]>(INITIAL_DRAFTS);
  const [activeDraftId, setActiveDraftId] = useState<string>(INITIAL_DRAFTS[0].id);
  const [copilotInput, setCopilotInput] = useState("");

  const activeDraft = drafts.find(d => d.id === activeDraftId);

  const handleContentChange = useCallback((html: string) => {
    setDrafts(prev =>
      prev.map(d =>
        d.id === activeDraftId ? { ...d, content: html } : d
      )
    );
  }, [activeDraftId]);

  const handleNewDraft = () => {
    const newDraft: Draft = {
      id: `draft-${Date.now()}`,
      title: "Untitled Draft",
      status: "draft",
      content: "<h1>New Draft</h1><p>Start writing...</p>",
    };
    setDrafts(prev => [...prev, newDraft]);
    setActiveDraftId(newDraft.id);
  };

  const getStatusLabel = (status: Draft["status"]) => {
    switch (status) {
      case "draft": return "Draft";
      case "in-progress": return "In Progress";
      case "final-review": return "Final Review";
    }
  };

  return (
    <div className="space-y-12 pb-20 h-full flex flex-col">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Writing Studio</h1>
          <p className="text-muted font-serif italic text-xl">Synthesize findings into coherent scholarly narrative.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleNewDraft}
            className="btn-editorial flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Draft
          </button>
        </div>
      </header>

      <div className="accent-line" />

      <div className="editorial-grid gap-12 flex-1">
        {/* Sidebar: Drafts & Sources */}
        <aside className="col-span-12 md:col-span-3 space-y-12 overflow-y-auto">
          <div className="space-y-6">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Drafting</h3>
            <nav className="space-y-4">
              {drafts.map(draft => (
                <DraftItem
                  key={draft.id}
                  title={draft.title}
                  status={getStatusLabel(draft.status)}
                  active={draft.id === activeDraftId}
                  onClick={() => setActiveDraftId(draft.id)}
                />
              ))}
            </nav>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Active Citations</h3>
              <span className="text-[10px] font-mono text-intel-blue bg-intel-blue/5 px-2 py-0.5 rounded-full">
                {CITATIONS.length} Loaded
              </span>
            </div>
            <div className="space-y-4">
              {CITATIONS.map((citation, i) => (
                <CitationItem
                  key={i}
                  author={citation.author}
                  year={citation.year}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Editor Main Area */}
        <main className="col-span-12 md:col-span-6 space-y-8 flex flex-col">
          <div className="bg-white border border-border flex-1 flex flex-col shadow-editorial overflow-hidden">
            {activeDraft ? (
              <RichTextEditor
                content={activeDraft.content}
                onChange={handleContentChange}
                placeholder="Start writing your research synthesis..."
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted font-serif italic">
                Select a draft to start editing
              </div>
            )}
          </div>
        </main>

        {/* AI Co-pilot Panel */}
        <aside className="col-span-12 md:col-span-3 space-y-6 flex flex-col">
          <div className="bg-ink text-paper flex-1 flex flex-col shadow-editorial">
            <div className="p-6 border-b border-white/10 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-intel-blue" />
              <h3 className="font-mono text-[10px] uppercase tracking-widest">Intelligence Co-pilot</h3>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-serif italic text-paper/60">Suggested Synthesis:</p>
                <div className="p-4 bg-white/5 border border-white/10 text-sm font-serif italic leading-relaxed">
                  "Consider citing Zhu et al. (2023) here to support your claim about hallucination patterns in medical evidence synthesis."
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-serif italic text-paper/60">Research Gap Detected:</p>
                <p className="text-sm font-serif italic leading-relaxed text-intel-blue">
                  You haven't mentioned the impact on low-resource research environments.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-white/10">
              <div className="relative">
                <input
                  type="text"
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  placeholder="Ask your research co-pilot..."
                  className="w-full bg-white/5 border border-white/20 p-3 pr-12 text-xs font-serif italic outline-none focus:border-intel-blue"
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-intel-blue transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

interface DraftItemProps {
  title: string;
  status: string;
  active?: boolean;
  onClick?: () => void;
}

function DraftItem({ title, status, active, onClick }: DraftItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-4 border border-border group cursor-pointer transition-all",
        active ? "border-ink bg-white shadow-editorial" : "hover:border-ink hover:bg-paper"
      )}
    >
      <h4 className="font-serif italic text-lg leading-tight mb-2 group-hover:underline">{title}</h4>
      <div className="flex justify-between items-center">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{status}</span>
        <ChevronRight className="w-4 h-4 text-border group-hover:text-ink" />
      </div>
    </div>
  );
}

function CitationItem({ author, year }: { author: string, year: number }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
      <div className="flex items-center gap-2">
        <FileText className="w-3 h-3 text-muted" />
        <span className="text-sm font-serif italic">{author} ({year})</span>
      </div>
      <button className="text-[10px] font-mono uppercase text-intel-blue opacity-0 group-hover:opacity-100 transition-opacity">Cite</button>
    </div>
  );
}
