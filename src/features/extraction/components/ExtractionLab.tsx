"use client";

import { useState } from "react";
import { 
  FileText, 
  GitCompare, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  Save, 
  Eye, 
  ShieldCheck,
  User,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ExtractionItem {
  id: string;
  study: {
    title: string;
    authors: string;
    year: number;
  };
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CONFLICT';
  reviewers: string[];
}

const MOCK_EXTRACTION_QUEUE: ExtractionItem[] = [
  {
    id: "e1",
    study: { title: "LLMs in Clinical Medicine", authors: "Anderson, K.", year: 2024 },
    status: 'CONFLICT',
    reviewers: ["Zak A.", "Mina S."]
  },
  {
    id: "e2",
    study: { title: "Rapid Evidence Synthesis Methods", authors: "Baker, J.", year: 2023 },
    status: 'IN_PROGRESS',
    reviewers: ["Alex L."]
  }
];

export function ExtractionLab() {
  const [activeView, setActiveView] = useState<'queue' | 'discrepancy'>('queue');

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Extraction Lab</h1>
          <p className="text-muted font-serif italic text-xl">Harvesting evidence through dual-reviewer validation.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveView('queue')}
            className={cn(
              "px-6 py-2 border text-[10px] font-mono uppercase tracking-widest transition-all",
              activeView === 'queue' ? "bg-ink text-paper border-ink" : "border-border hover:bg-paper"
            )}
          >
            Work Queue
          </button>
          <button 
            onClick={() => setActiveView('discrepancy')}
            className={cn(
              "px-6 py-2 border text-[10px] font-mono uppercase tracking-widest transition-all",
              activeView === 'discrepancy' ? "bg-intel-blue text-white border-intel-blue" : "border-border hover:bg-paper"
            )}
          >
            Discrepancies (1)
          </button>
        </div>
      </header>

      <div className="accent-line" />

      {activeView === 'queue' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Awaiting Extraction</h3>
            <span className="font-mono text-[10px] text-muted">Showing {MOCK_EXTRACTION_QUEUE.length} studies</span>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {MOCK_EXTRACTION_QUEUE.map((item) => (
              <ExtractionCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : (
        <DiscrepancyResolver />
      )}
    </div>
  );
}

function ExtractionCard({ item }: { item: ExtractionItem }) {
  const statusColors = {
    PENDING: "border-border opacity-60",
    IN_PROGRESS: "border-border",
    COMPLETED: "border-emerald-200 bg-emerald-50/10",
    CONFLICT: "border-rose-200 bg-rose-50/10"
  };

  return (
    <div className={cn(
      "group bg-white border p-8 hover:border-ink transition-all flex justify-between items-center",
      statusColors[item.status]
    )}>
      <div className="flex items-center gap-8 flex-1">
        <div className="w-12 h-12 border border-border flex items-center justify-center bg-paper group-hover:border-ink transition-colors">
          <FileText className="w-6 h-6 text-muted group-hover:text-ink" />
        </div>
        <div className="space-y-2">
          <h4 className="text-2xl font-serif group-hover:underline cursor-pointer">{item.study.title}</h4>
          <div className="flex items-center gap-4 text-xs font-sans text-muted">
            <span className="font-bold">{item.study.authors}</span>
            <span className="w-1 h-1 bg-border rounded-full" />
            <span>{item.study.year}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-12">
        <div className="flex flex-col items-end gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Status</span>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              item.status === 'CONFLICT' ? "bg-rose-500 animate-pulse" : 
              item.status === 'COMPLETED' ? "bg-emerald-500" : "bg-amber-500"
            )} />
            <span className="font-serif italic font-bold">{item.status}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Assigned</span>
          <div className="flex -space-x-2">
            {item.reviewers.map((r, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-paper flex items-center justify-center text-[10px] font-bold" title={r}>
                {r.split(' ').map(n => n[0]).join('')}
              </div>
            ))}
          </div>
        </div>

        <button className="w-12 h-12 border border-border flex items-center justify-center hover:bg-ink hover:text-paper transition-all">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

function DiscrepancyResolver() {
  return (
    <div className="editorial-grid gap-12">
      <div className="col-span-12 space-y-8">
        <div className="flex items-center gap-4 p-6 bg-rose-50 border border-rose-100 text-rose-700">
          <AlertCircle className="w-5 h-5" />
          <p className="font-serif italic">Conflicting data points detected in <span className="font-bold">3 fields</span> for Anderson et al. (2024).</p>
        </div>

        <div className="grid grid-cols-12 gap-px bg-border border border-border overflow-hidden shadow-editorial">
          {/* Header */}
          <div className="col-span-4 bg-paper/50 p-6 font-mono text-[10px] uppercase tracking-widest text-muted border-b border-border">Data Field</div>
          <div className="col-span-4 bg-paper/50 p-6 font-mono text-[10px] uppercase tracking-widest text-muted border-b border-border flex items-center gap-2">
            <User className="w-3 h-3" /> Zak A. (Reviewer 1)
          </div>
          <div className="col-span-4 bg-paper/50 p-6 font-mono text-[10px] uppercase tracking-widest text-muted border-b border-border flex items-center gap-2">
            <User className="w-3 h-3" /> Mina S. (Reviewer 2)
          </div>

          {/* Rows */}
          <DiscrepancyRow 
            field="Sample Size (N)" 
            val1="1,248" 
            val2="1,240" 
            isConflict 
          />
          <DiscrepancyRow 
            field="Methodology" 
            val1="Randomized Controlled Trial" 
            val2="Randomized Controlled Trial" 
          />
          <DiscrepancyRow 
            field="Mean Age" 
            val1="42.5 (SD 12)" 
            val2="42.5" 
            isConflict 
          />
          <DiscrepancyRow 
            field="Primary Outcome" 
            val1="Clinical sensitivity (99%)" 
            val2="Diagnostic accuracy" 
            isConflict 
          />
        </div>

        <div className="bg-ink text-paper p-12 space-y-8 shadow-editorial relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <GitCompare className="w-32 h-32" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-3xl font-serif">Final Harmonization</h3>
            <p className="text-paper/60 font-serif italic text-lg leading-relaxed">
              Synthesize the discrepant extractions into a single canonical record. 
              The chosen values will be used for all subsequent analysis and PRISMA reporting.
            </p>
          </div>

          <div className="pt-8 flex justify-between items-center border-t border-white/10">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-paper/40">
              <ShieldCheck className="w-3 h-3" />
              Harmonization is final and logs all changes
            </div>
            <button className="btn-editorial bg-paper text-ink border-paper px-12">Commit Harmonized Record</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiscrepancyRow({ field, val1, val2, isConflict }: { field: string, val1: string, val2: string, isConflict?: boolean }) {
  return (
    <>
      <div className="col-span-4 bg-white p-8">
        <h5 className="font-serif font-bold italic text-lg">{field}</h5>
      </div>
      <div className={cn(
        "col-span-4 p-8 flex items-start justify-between group cursor-pointer transition-all",
        isConflict ? "bg-rose-50/30" : "bg-white"
      )}>
        <p className="font-serif italic text-muted text-lg">"{val1}"</p>
        <div className="w-6 h-6 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Check className="w-3 h-3" />
        </div>
      </div>
      <div className={cn(
        "col-span-4 p-8 flex items-start justify-between group cursor-pointer transition-all",
        isConflict ? "bg-rose-50/30" : "bg-white"
      )}>
        <p className="font-serif italic text-muted text-lg">"{val2}"</p>
        <div className="w-6 h-6 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Check className="w-3 h-3" />
        </div>
      </div>
    </>
  );
}

