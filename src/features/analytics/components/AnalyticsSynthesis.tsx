"use client";

import { useState } from "react";
import { 
  BarChart3, 
  PieChart, 
  LineChart, 
  Layers, 
  Download, 
  Maximize2,
  FileText,
  Share2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Globe,
  GitMerge
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function AnalyticsSynthesis() {
  const [activeTab, setActiveTab] = useState<'prisma' | 'trends' | 'meta'>('prisma');

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Synthesis Analytics</h1>
          <p className="text-muted font-serif italic text-xl">Visualizing the flow and trends of scientific evidence.</p>
        </div>
        <div className="flex gap-4">
          <button className="px-6 py-2 border border-border text-xs font-mono uppercase tracking-widest hover:bg-paper transition-all flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Share Dashboard
          </button>
          <button className="btn-editorial flex items-center gap-2">
            <Download className="w-4 h-4" /> Export PRISMA
          </button>
        </div>
      </header>

      <div className="accent-line" />

      {/* Analytics Tabs */}
      <div className="flex gap-12 border-b border-border">
        <TabButton active={activeTab === 'prisma'} onClick={() => setActiveTab('prisma')} label="PRISMA Flow" />
        <TabButton active={activeTab === 'trends'} onClick={() => setActiveTab('trends')} label="Publication Trends" />
        <TabButton active={activeTab === 'meta'} onClick={() => setActiveTab('meta')} label="Meta-Analysis" />
      </div>

      <div className="editorial-grid gap-12">
        <main className="col-span-12 md:col-span-8 space-y-12">
          {activeTab === 'prisma' && (
            <div className="bg-white border border-border p-12 space-y-12 relative overflow-hidden group">
              <div className="flex justify-between items-center">
                <h3 className="text-4xl font-serif italic">PRISMA 2020 Flow Diagram</h3>
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Generated Real-time</span>
              </div>
              
              {/* Mock PRISMA Diagram */}
              <div className="space-y-12 max-w-2xl mx-auto py-8">
                <PrismaNode label="Identification" count={1248} sub="Records identified from databases" />
                <PrismaConnector type="merge" />
                <div className="grid grid-cols-2 gap-px bg-border border border-border">
                  <div className="bg-white p-8 text-center space-y-2">
                    <span className="font-mono text-xs text-muted uppercase">Duplicates Removed</span>
                    <div className="text-3xl font-serif font-bold text-rose-600">412</div>
                  </div>
                  <div className="bg-white p-8 text-center space-y-2">
                    <span className="font-mono text-xs text-muted uppercase">Unique Records</span>
                    <div className="text-3xl font-serif font-bold">836</div>
                  </div>
                </div>
                <PrismaConnector />
                <div className="grid grid-cols-2 gap-12">
                  <PrismaNode label="Screening" count={836} sub="Titles and abstracts screened" />
                  <div className="bg-rose-50 border border-rose-100 p-8 flex flex-col justify-center text-center">
                    <span className="font-mono text-[10px] uppercase text-rose-700 font-bold mb-2">Excluded</span>
                    <div className="text-2xl font-serif font-bold text-rose-700">642</div>
                    <span className="text-[10px] font-serif italic text-rose-600 mt-2">Did not meet inclusion criteria</span>
                  </div>
                </div>
                <PrismaConnector />
                <PrismaNode label="Eligibility" count={194} sub="Full-text reports assessed" active />
              </div>
            </div>
          )}

          {activeTab === 'trends' && (
            <div className="space-y-12">
              <div className="bg-white border border-border p-12 space-y-8 shadow-editorial">
                <h3 className="text-3xl font-serif italic">Publication Evolution</h3>
                <div className="h-80 w-full flex items-end gap-2 px-4 border-b border-border">
                  {[20, 35, 45, 30, 65, 80, 100, 120, 150, 180].map((h, i) => (
                    <motion.div 
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      className="flex-1 bg-ink hover:bg-intel-blue transition-colors relative group"
                    >
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 font-mono text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                        {2015 + i}
                      </span>
                    </motion.div>
                  ))}
                </div>
                <div className="flex justify-between font-mono text-[10px] uppercase text-muted">
                  <span>2015</span>
                  <span>2025</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="bg-white border border-border p-8 space-y-4">
                  <div className="flex items-center gap-2 text-muted">
                    <Globe className="w-4 h-4" />
                    <span className="font-mono text-[10px] uppercase tracking-widest">Geographic Impact</span>
                  </div>
                  <h4 className="text-2xl font-serif italic">Top 5 Countries</h4>
                  <ul className="space-y-3 pt-4">
                    <GeoRow label="USA" val={42} />
                    <GeoRow label="China" val={38} />
                    <GeoRow label="UK" val={25} />
                    <GeoRow label="Germany" val={18} />
                    <GeoRow label="Canada" val={12} />
                  </ul>
                </div>
                <div className="bg-white border border-border p-8 space-y-4">
                  <div className="flex items-center gap-2 text-muted">
                    <Layers className="w-4 h-4" />
                    <span className="font-mono text-[10px] uppercase tracking-widest">Methodology Split</span>
                  </div>
                  <h4 className="text-2xl font-serif italic">Research Design</h4>
                  <ul className="space-y-3 pt-4">
                    <GeoRow label="RCT" val={65} color="bg-emerald-500" />
                    <GeoRow label="Cohort" val={20} color="bg-amber-500" />
                    <GeoRow label="Case-Control" val={10} color="bg-rose-500" />
                    <GeoRow label="Qualitative" val={5} color="bg-ink" />
                  </ul>
                </div>
              </div>
            </div>
          )}
        </main>

        <aside className="col-span-12 md:col-span-4 space-y-8">
          <div className="bg-ink text-paper p-8 space-y-8 shadow-editorial">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-intel-blue" />
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">AI Intelligence Report</h3>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="font-serif font-bold italic text-lg">Trend Detection</h4>
                <p className="text-sm font-serif italic text-paper/60 leading-relaxed">
                  The volume of publications using "Large Language Models" has increased by 340% in the last 18 months. 
                  Most evidence is originating from clinical informatics journals rather than pure methodology venues.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-serif font-bold italic text-lg">Potential Bias Warning</h4>
                <p className="text-sm font-serif italic text-rose-400/80 leading-relaxed">
                  A cluster of studies (n=12) from one specific laboratory shows consistently higher effect sizes than the global average.
                </p>
              </div>
            </div>
            <div className="accent-line bg-white opacity-10" />
            <button className="w-full py-4 border border-white/20 text-[10px] font-mono uppercase tracking-widest hover:bg-white/10 transition-colors">
              Generate Synthesis Summary
            </button>
          </div>

          <div className="p-8 border border-border space-y-6">
            <h4 className="text-xs font-mono uppercase tracking-widest text-muted">Project Momentum</h4>
            <div className="flex items-center gap-4">
              <TrendingUp className="w-8 h-8 text-emerald-500" />
              <div>
                <div className="text-2xl font-serif font-bold tracking-tight">+12%</div>
                <p className="text-[10px] font-mono uppercase text-muted">Screening velocity (7d)</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "pb-4 text-xs font-mono uppercase tracking-widest transition-all relative",
        active ? "text-ink" : "text-muted hover:text-ink"
      )}
    >
      {label}
      {active && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-ink" />}
    </button>
  );
}

function PrismaNode({ label, count, sub, active }: { label: string, count: number, sub: string, active?: boolean }) {
  return (
    <div className={cn(
      "p-8 border-2 text-center space-y-2 transition-all",
      active ? "border-ink bg-white shadow-editorial scale-105 z-10" : "border-border bg-white"
    )}>
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</span>
      <div className="text-4xl font-serif font-bold italic">{count}</div>
      <p className="text-xs font-serif italic text-muted">{sub}</p>
    </div>
  );
}

function PrismaConnector({ type = 'straight' }: { type?: 'merge' | 'straight' }) {
  return (
    <div className="flex justify-center -my-px">
      <div className="w-[2px] h-12 bg-border relative">
        <div className="absolute -bottom-1 -left-[3px] w-2 h-2 border-b-2 border-r-2 border-border rotate-45" />
      </div>
    </div>
  );
}

function GeoRow({ label, val, color = "bg-ink" }: { label: string, val: number, color?: string }) {
  return (
    <li className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono uppercase tracking-tighter">
        <span>{label}</span>
        <span>{val}%</span>
      </div>
      <div className="h-1 bg-paper relative rounded-full overflow-hidden">
        <div className={cn("absolute left-0 top-0 h-full transition-all duration-1000", color)} style={{ width: `${val}%` }} />
      </div>
    </li>
  );
}

