"use client";

import { useState } from "react";
import { 
  Check, 
  X, 
  AlertTriangle, 
  User, 
  ArrowRight,
  MessageSquare,
  History,
  ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Conflict {
  id: string;
  study: {
    title: string;
    authors: string;
    year: number;
    abstract: string;
  };
  decisions: {
    reviewer: string;
    decision: 'INCLUDE' | 'EXCLUDE' | 'MAYBE';
    reasoning?: string;
  }[];
}

const MOCK_CONFLICTS: Conflict[] = [
  {
    id: "c1",
    study: {
      title: "Generative AI in Clinical Decision Support: A Critical Review",
      authors: "Lee, S., et al.",
      year: 2024,
      abstract: "The rapid integration of generative AI into clinical environments necessitates a rigorous evaluation of evidence. This review synthesizes current literature on transformer-based models..."
    },
    decisions: [
      { reviewer: "Zak A.", decision: 'INCLUDE', reasoning: "Explicitly mentions clinical decision support and transformers." },
      { reviewer: "Mina S.", decision: 'EXCLUDE', reasoning: "Focuses on LLMs in general, not specifically the methodology we are reviewing." }
    ]
  }
];

export function ConflictAdjudicator() {
  const [activeConflict, setActiveConflict] = useState<Conflict | null>(MOCK_CONFLICTS[0]);

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Conflict Adjudication</h1>
          <p className="text-muted font-serif italic text-xl">Resolving divergent evidence assessments with methodological rigor.</p>
        </div>
        <div className="flex items-center gap-4 bg-white border border-border px-6 py-2 shadow-editorial">
          <ShieldCheck className="w-5 h-5 text-intel-blue" />
          <span className="font-mono text-xs uppercase tracking-widest">Adjudicator Mode Active</span>
        </div>
      </header>

      <div className="accent-line" />

      {activeConflict ? (
        <div className="editorial-grid gap-12">
          {/* Study Overview (Aside) */}
          <aside className="col-span-12 md:col-span-4 space-y-8">
            <div className="bg-white border border-border p-8 space-y-6 sticky top-8">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted border-b border-border pb-4">Study under Review</h3>
              <div className="space-y-4">
                <h4 className="text-3xl font-serif leading-tight">{activeConflict.study.title}</h4>
                <p className="font-serif italic text-muted text-sm">{activeConflict.study.authors} ({activeConflict.study.year})</p>
                <div className="accent-line opacity-5" />
                <p className="text-sm font-serif italic leading-relaxed text-muted line-clamp-[12]">
                  {activeConflict.study.abstract}
                </p>
                <button className="text-[10px] font-mono uppercase tracking-widest text-intel-blue hover:underline">View Full Abstract</button>
              </div>
            </div>
          </aside>

          {/* Adjudication Workspace */}
          <main className="col-span-12 md:col-span-8 space-y-12">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Reviewer Discrepancies</h3>
            
            <div className="grid grid-cols-2 gap-px bg-border border border-border overflow-hidden">
              {activeConflict.decisions.map((d, i) => (
                <div key={i} className="bg-white p-8 space-y-8">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-paper border border-border flex items-center justify-center font-bold text-[10px]">
                        {d.reviewer.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-serif font-bold italic">{d.reviewer}</span>
                    </div>
                    <DecisionBadge decision={d.decision} />
                  </div>
                  
                  <div className="space-y-4">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted">Reasoning</label>
                    <p className="font-serif italic text-lg leading-relaxed">"{d.reasoning}"</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Adjudication Actions */}
            <div className="bg-ink text-paper p-12 space-y-8 shadow-editorial relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <ShieldCheck className="w-32 h-32" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-3xl font-serif">Final Adjudication</h3>
                <p className="text-paper/60 font-serif italic">Your decision will override the current discrepancy and advance the study.</p>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-4">
                <FinalAction 
                  label="Include" 
                  icon={<Check className="w-5 h-5" />} 
                  color="green" 
                  onClick={() => console.log('Include')}
                />
                <FinalAction 
                  label="Exclude" 
                  icon={<X className="w-5 h-5" />} 
                  color="red" 
                  onClick={() => console.log('Exclude')}
                />
                <FinalAction 
                  label="Needs Discussion" 
                  icon={<MessageSquare className="w-5 h-5" />} 
                  color="muted" 
                  onClick={() => console.log('Discuss')}
                />
              </div>

              <div className="pt-8 flex justify-between items-center border-t border-white/10">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-paper/40">
                  <AlertTriangle className="w-3 h-3" />
                  Decision will be logged in the permanent audit trail
                </div>
                <button className="text-paper/60 hover:text-paper font-serif italic text-sm flex items-center gap-2 transition-colors">
                  Next Conflict <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </main>
        </div>
      ) : (
        <div className="py-40 text-center space-y-4">
          <Check className="w-12 h-12 mx-auto text-muted opacity-20" />
          <h2 className="text-3xl font-serif italic text-muted">All conflicts have been adjudicated.</h2>
          <button className="btn-editorial">Return to Project Overview</button>
        </div>
      )}
    </div>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const colors = {
    INCLUDE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    EXCLUDE: "bg-rose-50 text-rose-700 border-rose-200",
    MAYBE: "bg-amber-50 text-amber-700 border-amber-200"
  };
  return (
    <span className={cn(
      "px-3 py-1 border text-[10px] font-mono uppercase tracking-widest rounded-full",
      colors[decision as keyof typeof colors]
    )}>
      {decision}
    </span>
  );
}

function FinalAction({ label, icon, color, onClick }: { label: string, icon: React.ReactNode, color: 'green' | 'red' | 'muted', onClick: () => void }) {
  const hoverColors = {
    green: "hover:bg-emerald-500 hover:text-white border-emerald-500/30",
    red: "hover:bg-rose-500 hover:text-white border-rose-500/30",
    muted: "hover:bg-paper hover:text-ink border-white/20"
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-8 border transition-all gap-4 bg-white/5",
        hoverColors[color]
      )}
    >
      <div className="w-10 h-10 border border-current flex items-center justify-center">
        {icon}
      </div>
      <span className="font-serif italic text-xl tracking-tight">{label}</span>
    </button>
  );
}

