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
  GitMerge,
  Users2
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { ScreeningAnalytics } from "@/features/screening/components/ScreeningAnalytics";
import { PrismaFlow } from "@/features/analytics/components/PrismaFlow";
import { ExportMenu } from "@/features/projects/components/ExportMenu";
import { useSSE } from "@/hooks/use-sse";
import { useAppStore } from "@/stores/app-store";
import { toast } from "sonner";

export function AnalyticsSynthesis() {
  const params = useParams();
  const projectId = params.id as string;
  const [activeTab, setActiveTab] = useState<'screening' | 'prisma' | 'trends' | 'meta'>('screening');

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Dashboard link copied to clipboard");
  };

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Synthesis Analytics</h1>
          <p className="text-muted font-serif italic text-xl">Visualizing the flow and trends of scientific evidence.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleShare}
            className="px-6 py-2 border border-border text-xs font-mono uppercase tracking-widest hover:bg-paper transition-all flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" /> Share Dashboard
          </button>
          <ExportMenu projectId={projectId} />
        </div>
      </header>

      <div className="accent-line" />

      {/* Analytics Tabs */}
      <div className="flex gap-12 border-b border-border">
        <TabButton active={activeTab === 'screening'} onClick={() => setActiveTab('screening')} label="Team & Progress" />
        <TabButton active={activeTab === 'prisma'} onClick={() => setActiveTab('prisma')} label="PRISMA Flow" />
        <TabButton active={activeTab === 'trends'} onClick={() => setActiveTab('trends')} label="Publication Trends" />
        <TabButton active={activeTab === 'meta'} onClick={() => setActiveTab('meta')} label="Meta-Analysis" />
      </div>

      <div className="editorial-grid gap-12">
        <main className="col-span-12 md:col-span-8 space-y-12">
          {activeTab === 'screening' && (
            <ScreeningAnalytics projectId={projectId} />
          )}

          {activeTab === 'prisma' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <PrismaFlow projectId={projectId} />
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

