"use client";

import { useState } from "react";
import { 
  PenTool, 
  Sparkles, 
  BookOpen, 
  Layout, 
  FileText, 
  ChevronRight, 
  Hash,
  MessageSquare,
  Send
} from "lucide-react";
import { cn } from "@/lib/utils";

export function WritingAssistant() {
  const [activeDraft, setActiveDraft] = useState(0);

  return (
    <div className="space-y-12 pb-20 h-full flex flex-col">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Writing Studio</h1>
          <p className="text-muted font-serif italic text-xl">Synthesize findings into coherent scholarly narrative.</p>
        </div>
        <div className="flex gap-4">
          <button className="btn-editorial flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
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
              <DraftItem title="Literature Review: AI in Medicine" status="In Progress" active />
              <DraftItem title="Methodology: Systematic Synthesis" status="Draft" />
              <DraftItem title="Introduction: The Future of Reviews" status="Final Review" />
            </nav>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Active Citations</h3>
              <span className="text-[10px] font-mono text-intel-blue bg-intel-blue/5 px-2 py-0.5 rounded-full">12 Loaded</span>
            </div>
            <div className="space-y-4">
              <CitationItem author="Marshall et al." year={2024} />
              <CitationItem author="Zhu et al." year={2023} />
              <CitationItem author="Grant, R." year={2024} />
            </div>
          </div>
        </aside>

        {/* Editor Main Area */}
        <main className="col-span-12 md:col-span-6 space-y-8 flex flex-col">
          <div className="bg-white border border-border flex-1 flex flex-col shadow-editorial">
            {/* Toolbar */}
            <div className="h-12 border-b border-border flex items-center px-4 gap-6 bg-paper/30">
              <div className="flex gap-2">
                <EditorTool icon={<PenTool className="w-4 h-4" />} />
                <EditorTool icon={<Layout className="w-4 h-4" />} />
                <EditorTool icon={<Hash className="w-4 h-4" />} />
              </div>
              <div className="h-4 w-[1px] bg-border" />
              <span className="text-xs font-mono text-muted uppercase tracking-widest">Auto-saving...</span>
            </div>

            {/* Canvas */}
            <div className="flex-1 p-12 overflow-y-auto font-serif">
              <h2 className="text-4xl mb-12">The Evolution of Systematic Evidence Synthesis</h2>
              <div className="space-y-8 text-xl leading-relaxed text-ink/90 italic">
                <p>
                  As the volume of scholarly publications continues to grow at an exponential rate, traditional methods of manual evidence synthesis are becoming increasingly untenable. The integration of large language models (LLMs) into the systematic review pipeline represents not just an incremental efficiency gain, but a fundamental paradigm shift in how knowledge is aggregated.
                </p>
                <p>
                  Marshall et al. (2024) have demonstrated that transformer-based architectures can achieve human-level sensitivity in title and abstract screening, though the risk of systemic bias remains a critical concern for methodology rigor. In this review, we examine the ethical implications of semi-automated discovery...
                </p>
                <div className="h-8 border-l-2 border-intel-blue pl-6 my-12 animate-pulse">
                  <span className="text-intel-blue/40">Continue writing with AI Co-pilot...</span>
                </div>
              </div>
            </div>
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

function DraftItem({ title, status, active }: { title: string, status: string, active?: boolean }) {
  return (
    <div className={cn(
      "p-4 border border-border group cursor-pointer transition-all",
      active ? "border-ink bg-white shadow-editorial" : "hover:border-ink hover:bg-paper"
    )}>
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

function EditorTool({ icon }: { icon: React.ReactNode }) {
  return (
    <button className="p-2 hover:bg-white border border-transparent hover:border-border transition-all">
      {icon}
    </button>
  );
}

function PlusIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}

