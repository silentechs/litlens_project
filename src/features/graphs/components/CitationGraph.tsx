"use client";

import { useState } from "react";
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize,
  Layers,
  Filter,
  Sparkles,
  MousePointer2,
  X as XIcon,
  Plus as PlusIcon,
  Network,
  Upload,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { GraphControl } from "./GraphControl";
import { GraphLegendItem } from "./GraphLegendItem";
import { useCytoscape } from "../hooks/use-cytoscape";

const MOCK_ELEMENTS: cytoscape.ElementDefinition[] = [
  { data: { id: "seed", label: "Primary Seed: LLM Screening", size: 40, type: "core" } },
  { data: { id: "n1", label: "Marshall et al. (2024)", size: 30 } },
  { data: { id: "n2", label: "Zhu et al. (2023)", size: 30 } },
  { data: { id: "n3", label: "Evidence Synthesis", size: 20 } },
  { data: { id: "n4", label: "NLP Methodology", size: 20 } },
  { data: { id: "n5", label: "Ethics in AI", size: 20 } },
  // Edges
  { data: { id: "e1", source: "seed", target: "n1" } },
  { data: { id: "e2", source: "seed", target: "n2" } },
  { data: { id: "e3", source: "seed", target: "n3" } },
  { data: { id: "e4", source: "n1", target: "n4" } },
  { data: { id: "e5", source: "n2", target: "n5" } },
];

export function CitationGraph() {
  const [elements, setElements] = useState<cytoscape.ElementDefinition[]>(MOCK_ELEMENTS);
  const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);

  const { containerRef, cyRef } = useCytoscape(elements, {
    onNodeClick: (id: string, data: any) => {
      setSelectedNodeData(data);
    },
    onCanvasClick: () => {
      setSelectedNodeData(null);
    }
  });

  const isEmpty = elements.length === 0;

  return (
    <div className="space-y-8 h-full flex flex-col">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Research Graph</h1>
          <p className="text-muted font-serif italic text-xl">Mapping the intellectual lineage of your field.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setElements([])}
            className="px-4 py-2 border border-border text-[10px] font-mono uppercase tracking-widest hover:bg-paper transition-all"
          >
            Clear Canvas
          </button>
          <button className="btn-editorial flex items-center gap-2" onClick={() => setElements(MOCK_ELEMENTS)}>
            <PlusIcon className="w-5 h-5" />
            New Graph
          </button>
        </div>
      </header>

      <div className="accent-line" />

      {/* Graph Visualizer Shell */}
      <div className="flex-1 relative bg-white border border-border min-h-[600px] overflow-hidden group shadow-sm rounded-sm">
        {isEmpty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center space-y-8 bg-paper/20">
            <div className="w-24 h-24 bg-white border border-border rounded-full flex items-center justify-center shadow-sm">
              <Network className="w-10 h-10 text-muted opacity-20" />
            </div>
            <div className="space-y-3 max-w-md">
              <h2 className="text-4xl font-serif italic">The canvas is waiting.</h2>
              <p className="text-muted font-serif italic text-lg leading-relaxed">
                Start your research journey by connecting existing project data or importing a fresh bibliography.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
              <OnboardingCard
                icon={<Database className="w-6 h-6" />}
                title="Connect Project"
                description="Generate a graph from your current systematic review studies."
                onClick={() => setElements(MOCK_ELEMENTS)}
              />
              <OnboardingCard
                icon={<Upload className="w-6 h-6" />}
                title="Import Bibliography"
                description="Upload RIS or BibTeX files to map historical citations."
                onClick={() => console.log('Import')}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Graph UI Overlay: Controls */}
            <div className="absolute top-6 left-6 flex flex-col gap-4 z-10">
              <div className="bg-white/80 backdrop-blur-md border border-border shadow-editorial p-2 flex flex-col gap-2 rounded-sm">
                <GraphControl icon={<ZoomIn className="w-4 h-4" />} label="Zoom In" />
                <GraphControl icon={<ZoomOut className="w-4 h-4" />} label="Zoom Out" />
                <GraphControl icon={<Maximize className="w-4 h-4" />} label="Fit View" />
              </div>
              <div className="bg-white/80 backdrop-blur-md border border-border shadow-editorial p-2 flex flex-col gap-2 rounded-sm">
                <GraphControl icon={<Layers className="w-4 h-4" />} label="Layers" />
                <GraphControl icon={<Filter className="w-4 h-4" />} label="Filter" />
              </div>
            </div>

            {/* Graph UI Overlay: Search & Legend */}
            <div className="absolute top-6 right-6 flex flex-col gap-4 z-10 w-72">
              <div className="bg-white/80 backdrop-blur-md border border-border shadow-editorial p-4 space-y-4 rounded-sm">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
                  <input
                    type="text"
                    placeholder="Find node..."
                    className="w-full bg-paper border border-border pl-8 pr-2 py-1.5 text-[10px] font-mono uppercase tracking-tight outline-none focus:border-ink transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted">Legend</h4>
                  <div className="space-y-1.5">
                    <GraphLegendItem color="bg-intel-blue" label="Core Papers" />
                    <GraphLegendItem color="bg-ink" label="Citations" />
                    <GraphLegendItem color="bg-paper border border-border" label="Related" />
                  </div>
                </div>
              </div>
            </div>

            {/* Cytoscape Canvas */}
            <div ref={containerRef} className="absolute inset-0 w-full h-full bg-white transition-opacity duration-1000" />

            {/* Selection Details Panel (Floating) */}
            <AnimatePresence>
              {selectedNodeData && (
                <motion.div
                  initial={{ x: 400, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 400, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="absolute top-0 right-0 h-full w-96 bg-white border-l border-border shadow-editorial z-20 p-8 space-y-8 overflow-y-auto"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-1 bg-intel-blue/10 text-intel-blue text-[10px] font-mono uppercase tracking-widest rounded-sm">
                      {selectedNodeData.type === 'core' ? 'Core Paper' : 'Citation Reference'}
                    </span>
                    <button onClick={() => {
                      setSelectedNodeData(null);
                      cyRef.current?.nodes().unselect();
                    }} className="p-2 hover:bg-paper transition-colors rounded-full text-muted hover:text-ink"><XIcon className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-3xl font-serif leading-tight">{selectedNodeData.label}</h3>
                    <p className="text-muted font-serif italic text-sm">Influence Score: {(Math.random() * 0.9 + 0.1).toFixed(2)}</p>
                  </div>
                  <div className="accent-line" />
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted">Influence Metrics</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <MetricBox label="Citations" value={Math.floor(Math.random() * 100).toString()} />
                        <MetricBox label="PageRank" value={(Math.random() * 0.9 + 0.1).toFixed(2)} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted">Key Connections</h4>
                      <ul className="text-sm font-serif italic space-y-3">
                        <li className="hover:text-intel-blue cursor-pointer transition-colors border-b border-border/50 pb-2 flex justify-between items-center group/item">
                          <span>Cited by 12 papers</span>
                          <PlusIcon className="w-3 h-3 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        </li>
                        <li className="hover:text-intel-blue cursor-pointer transition-colors border-b border-border/50 pb-2 flex justify-between items-center group/item">
                          <span>References 45 works</span>
                          <PlusIcon className="w-3 h-3 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="pt-8 space-y-4">
                    <button className="btn-editorial w-full">Save to Library</button>
                    <button className="w-full py-3 border border-border font-serif italic hover:bg-paper transition-all">View Full Metadata</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Interaction Indicator */}
            <div className="absolute bottom-6 right-6 pointer-events-none">
              <div className="bg-white/80 backdrop-blur-md border border-border px-4 py-2 flex items-center gap-2 rounded-sm shadow-sm">
                <MousePointer2 className="w-3 h-3 text-muted" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Drag nodes or zoom to explore</span>
              </div>
            </div>
          </>
        )}
      </div>

      {!isEmpty && (
        <div className="bg-intel-blue/5 border border-intel-blue/20 p-8 flex gap-8 rounded-sm">
          <div className="w-12 h-12 bg-white border border-intel-blue/20 flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-6 h-6 text-intel-blue" />
          </div>
          <div className="space-y-2">
            <h3 className="font-serif italic text-xl text-intel-blue font-bold">Graph Insights</h3>
            <p className="text-intel-blue/70 font-serif italic leading-relaxed max-w-3xl">
              The citation cluster around "{elements[0]?.data?.label}" is growing 4x faster than traditional meta-analysis methodologies.
              There is a significant research gap between ethical framework publications and actual methodology implementation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function OnboardingCard({ icon, title, description, onClick }: { icon: React.ReactNode, title: string, description: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-border p-8 text-left space-y-4 hover:border-ink hover:shadow-editorial transition-all group rounded-sm"
    >
      <div className="w-12 h-12 bg-paper border border-border flex items-center justify-center group-hover:border-ink transition-colors">
        {icon}
      </div>
      <div className="space-y-1">
        <h4 className="text-xl font-serif font-bold italic leading-none">{title}</h4>
        <p className="text-sm font-serif italic text-muted leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">{description}</p>
      </div>
    </button>
  );
}

function MetricBox({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-paper p-4 border border-border rounded-sm">
      <label className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-1">{label}</label>
      <div className="text-xl font-mono font-bold tracking-tight">{value}</div>
    </div>
  );
}
