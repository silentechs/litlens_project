"use client";

import { useState } from "react";
import { 
  Copy, 
  ArrowRight, 
  GitMerge, 
  Check, 
  X, 
  Info,
  ChevronDown,
  ArrowDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface DuplicateCandidate {
  id: string;
  confidence: number;
  original: Paper;
  match: Paper;
}

interface Paper {
  title: string;
  authors: string;
  year: number;
  journal: string;
  doi?: string;
}

const MOCK_DUPLICATES: DuplicateCandidate[] = [
  {
    id: "d1",
    confidence: 0.98,
    original: {
      title: "Transformers for Evidence Synthesis",
      authors: "Smith, J., Doe, A.",
      year: 2024,
      journal: "J. of Informatics",
      doi: "10.1001/jit.2024.1"
    },
    match: {
      title: "Transformers for Evidence Synthesis: A Review",
      authors: "Smith J, Doe A",
      year: 2024,
      journal: "Journal of Informatics",
      doi: "10.1001/jit.2024.1"
    }
  }
];

export function DuplicateManager() {
  const [candidates, setCandidates] = useState(MOCK_DUPLICATES);

  const resolve = (id: string, action: 'MERGE' | 'KEEP_BOTH') => {
    setCandidates(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Duplicate Intelligence</h1>
          <p className="text-muted font-serif italic text-xl">Confirming identity across disparate bibliographic sources.</p>
        </div>
        <div className="flex gap-4">
          <button className="px-6 py-2 border border-border text-xs font-mono uppercase tracking-widest hover:bg-paper transition-all">
            Auto-Merge High Confidence
          </button>
        </div>
      </header>

      <div className="accent-line" />

      {candidates.length === 0 ? (
        <div className="py-40 text-center space-y-4">
          <Check className="w-12 h-12 mx-auto text-muted opacity-20" />
          <h2 className="text-3xl font-serif italic text-muted">No duplicate candidates remaining.</h2>
          <button className="btn-editorial">Continue to Screening</button>
        </div>
      ) : (
        <div className="space-y-12">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="editorial-grid gap-12 group">
              {/* Comparison Cards */}
              <div className="col-span-12 md:col-span-10 grid grid-cols-2 gap-px bg-border border border-border">
                <PaperCard title="Source Record A" paper={candidate.original} />
                <PaperCard title="Source Record B" paper={candidate.match} />
              </div>

              {/* Actions */}
              <div className="col-span-12 md:col-span-2 flex flex-col justify-center space-y-4">
                <div className="p-4 bg-intel-blue/5 border border-intel-blue/20 text-center mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-intel-blue">Confidence</span>
                  <div className="text-2xl font-serif font-bold text-intel-blue">{(candidate.confidence * 100).toFixed(0)}%</div>
                </div>
                
                <button 
                  onClick={() => resolve(candidate.id, 'MERGE')}
                  className="w-full bg-ink text-paper py-4 flex items-center justify-center gap-2 hover:bg-ink/90 transition-all"
                >
                  <GitMerge className="w-4 h-4" />
                  <span className="font-mono text-xs uppercase tracking-widest">Merge</span>
                </button>
                <button 
                  onClick={() => resolve(candidate.id, 'KEEP_BOTH')}
                  className="w-full py-4 border border-border flex items-center justify-center gap-2 hover:bg-paper transition-all"
                >
                  <Copy className="w-4 h-4" />
                  <span className="font-mono text-xs uppercase tracking-widest">Keep Both</span>
                </button>
              </div>

              {/* Difference Highlight */}
              <div className="col-span-12 -mt-8">
                <div className="flex items-center gap-4 text-xs font-mono text-muted uppercase tracking-widest">
                  <Info className="w-3 h-3" />
                  <span>Detected differences: Title phrasing, Journal abbreviation</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaperCard({ title, paper }: { title: string, paper: Paper }) {
  return (
    <div className="bg-white p-8 space-y-6 relative overflow-hidden">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted border-b border-border pb-4">{title}</h3>
      
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-muted tracking-tighter">Title</label>
          <p className="text-2xl font-serif leading-tight">{paper.title}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-4">
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-muted tracking-tighter">Authors</label>
            <p className="font-serif italic text-sm">{paper.authors}</p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-muted tracking-tighter">Journal</label>
            <p className="font-serif italic text-sm">{paper.journal}</p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-muted tracking-tighter">Year</label>
            <p className="font-mono text-sm">{paper.year}</p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-muted tracking-tighter">DOI</label>
            <p className="font-mono text-xs text-intel-blue">{paper.doi || "N/A"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

