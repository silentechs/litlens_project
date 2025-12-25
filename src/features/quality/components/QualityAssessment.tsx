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
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type RoBLevel = 'LOW' | 'HIGH' | 'UNCLEAR';

interface QualityDomain {
  id: string;
  label: string;
  description: string;
  level: RoBLevel;
  reasoning: string;
}

const MOCK_DOMAINS: QualityDomain[] = [
  { id: "d1", label: "Randomization Process", description: "Method of sequence generation and allocation concealment.", level: 'LOW', reasoning: "Authors used computer-generated sequence with central allocation." },
  { id: "d2", label: "Deviations from Intervention", description: "Effect of assignment or adhering to intervention.", level: 'UNCLEAR', reasoning: "Insufficient data on participant blinding for outcome assessment." },
  { id: "d3", label: "Missing Outcome Data", description: "Incomplete outcome data handling.", level: 'HIGH', reasoning: "High attrition rate (25%) in the treatment arm without intention-to-treat analysis." },
];

export function QualityAssessment() {
  const [activeTool, setActiveTool] = useState<'rob2' | 'grade'>('rob2');

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Methodological Quality</h1>
          <p className="text-muted font-serif italic text-xl">Assessing risk of bias and certainty of evidence.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTool('rob2')}
            className={cn(
              "px-6 py-2 border text-[10px] font-mono uppercase tracking-widest transition-all",
              activeTool === 'rob2' ? "bg-ink text-paper border-ink shadow-editorial" : "border-border hover:bg-paper"
            )}
          >
            RoB 2.0
          </button>
          <button 
            onClick={() => setActiveTool('grade')}
            className={cn(
              "px-6 py-2 border text-[10px] font-mono uppercase tracking-widest transition-all",
              activeTool === 'grade' ? "bg-intel-blue text-white border-intel-blue shadow-editorial" : "border-border hover:bg-paper"
            )}
          >
            GRADE Framework
          </button>
        </div>
      </header>

      <div className="accent-line" />

      <div className="editorial-grid gap-12">
        {/* Main Assessment Tool */}
        <main className="col-span-12 md:col-span-8 space-y-12">
          <div className="space-y-8">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Domains of Bias</h3>
              <span className="font-mono text-[10px] text-muted italic">Instrument: Cochrane RoB 2.0</span>
            </div>

            <div className="space-y-6">
              {MOCK_DOMAINS.map((domain) => (
                <DomainCard key={domain.id} domain={domain} />
              ))}
            </div>
          </div>

          <div className="bg-white border border-border p-12 space-y-8 shadow-editorial">
            <h3 className="text-3xl font-serif italic">Overall Risk of Bias</h3>
            <div className="flex items-center gap-8">
              <div className="w-24 h-24 rounded-full border-8 border-rose-100 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-rose-500 flex items-center justify-center text-white font-serif italic font-bold text-2xl">
                  High
                </div>
              </div>
              <div className="space-y-2 flex-1">
                <p className="text-lg font-serif leading-relaxed italic text-muted">
                  Study presents a high risk of bias due to significant attrition and lack of blinding in subjective outcome measures.
                </p>
                <button className="text-[10px] font-mono uppercase tracking-widest text-intel-blue hover:underline">Edit Consensus Statement</button>
              </div>
            </div>
          </div>
        </main>

        {/* Support & Metrics (Aside) */}
        <aside className="col-span-12 md:col-span-4 space-y-8">
          <div className="bg-ink text-paper p-8 space-y-8">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Bias Summary Graph</h3>
            <div className="space-y-6">
              <BiasBar label="Randomization" low={80} unclear={15} high={5} />
              <BiasBar label="Deviations" low={60} unclear={30} high={10} />
              <BiasBar label="Missing Data" low={40} unclear={20} high={40} />
              <BiasBar label="Outcome Measurement" low={90} unclear={5} high={5} />
            </div>
            <div className="accent-line bg-white opacity-10" />
            <button className="w-full py-4 border border-white/20 text-[10px] font-mono uppercase tracking-widest hover:bg-white/10 transition-colors">
              Export Quality Report
            </button>
          </div>

          <div className="p-8 border border-border space-y-6">
            <div className="flex items-center gap-2 text-intel-blue">
              <Sparkles className="w-4 h-4" />
              <h4 className="text-xs font-mono uppercase tracking-widest font-bold">AI Assistant</h4>
            </div>
            <p className="text-xs font-serif italic text-muted leading-relaxed">
              Based on the extraction data for this study, there is a strong indication of selective reporting in Domain 5. Would you like me to flag this for reviewer attention?
            </p>
            <button className="text-[10px] font-mono uppercase tracking-widest text-intel-blue flex items-center gap-2 hover:underline">
              Analyze Evidence <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DomainCard({ domain }: { domain: QualityDomain }) {
  const levels = {
    LOW: { icon: <CheckCircle2 className="w-5 h-5" />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
    HIGH: { icon: <ShieldAlert className="w-5 h-5" />, color: "text-rose-600 bg-rose-50 border-rose-100" },
    UNCLEAR: { icon: <HelpCircle className="w-5 h-5" />, color: "text-amber-600 bg-amber-50 border-amber-100" }
  };

  return (
    <div className="bg-white border border-border hover:border-ink transition-all group">
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h4 className="text-2xl font-serif font-bold italic leading-tight">{domain.label}</h4>
            <p className="text-sm font-serif italic text-muted">{domain.description}</p>
          </div>
          <div className={cn(
            "px-4 py-2 border rounded-full flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest",
            levels[domain.level].color
          )}>
            {levels[domain.level].icon}
            {domain.level} RISK
          </div>
        </div>

        <div className="accent-line opacity-5" />

        <div className="space-y-3">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted">Supporting Reasoning</label>
          <p className="font-serif italic text-lg leading-relaxed text-ink/80 group-hover:text-ink transition-colors">
            "{domain.reasoning}"
          </p>
        </div>
      </div>
      <div className="bg-paper/30 border-t border-border px-8 py-3 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-mono text-muted uppercase">Last modified by Zak A.</span>
        <button className="text-[10px] font-mono uppercase tracking-widest text-intel-blue hover:underline">Modify Assessment</button>
      </div>
    </div>
  );
}

function BiasBar({ label, low, unclear, high }: { label: string, low: number, unclear: number, high: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-tighter text-paper/60">
        <span>{label}</span>
      </div>
      <div className="h-1.5 flex overflow-hidden rounded-full">
        <div style={{ width: `${low}%` }} className="bg-emerald-500" />
        <div style={{ width: `${unclear}%` }} className="bg-amber-500" />
        <div style={{ width: `${high}%` }} className="bg-rose-500" />
      </div>
    </div>
  );
}

