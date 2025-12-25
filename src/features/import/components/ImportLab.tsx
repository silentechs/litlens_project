"use client";

import { useState, useCallback } from "react";
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Database,
  Search,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type ImportState = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

interface FileInfo {
  name: string;
  size: string;
  type: string;
  progress: number;
}

export function ImportLab() {
  const [state, setState] = useState<ImportState>('idle');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { label: 'Upload Sources', icon: <Upload className="w-4 h-4" /> },
    { label: 'Ingestion', icon: <Database className="w-4 h-4" /> },
    { label: 'Deduplication', icon: <Search className="w-4 h-4" /> },
  ];

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setState('uploading');
    
    // Simulate file upload
    const mockFile: FileInfo = {
      name: "Research_Export_2025.ris",
      size: "4.2 MB",
      type: "RIS",
      progress: 0
    };
    
    setFiles([mockFile]);
    
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setFiles(prev => [{ ...prev[0], progress: p }]);
      if (p >= 100) {
        clearInterval(interval);
        setState('processing');
        setActiveStep(1);
        
        // Simulate processing
        setTimeout(() => {
          setState('completed');
          setActiveStep(2);
        }, 2000);
      }
    }, 200);
  };

  return (
    <div className="space-y-12 pb-20">
      <header className="space-y-4">
        <h1 className="text-6xl font-serif">Import Lab</h1>
        <p className="text-muted font-serif italic text-xl">Ingest research data from disparate sources into your pipeline.</p>
      </header>

      {/* Lab Progress */}
      <div className="flex items-center gap-12 py-8 border-y border-border">
        {steps.map((s, i) => (
          <div key={i} className={cn(
            "flex items-center gap-4 transition-all",
            activeStep === i ? "text-ink" : "text-muted"
          )}>
            <div className={cn(
              "w-10 h-10 border flex items-center justify-center transition-all",
              activeStep === i ? "border-ink bg-white shadow-editorial" : "border-border"
            )}>
              {s.icon}
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Phase {i + 1}</span>
              <span className="font-serif italic text-lg">{s.label}</span>
            </div>
            {i < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-8 text-border" />}
          </div>
        ))}
      </div>

      <div className="editorial-grid gap-12">
        <div className="col-span-12 md:col-span-8">
          <AnimatePresence mode="wait">
            {state === 'idle' && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className="h-[400px] border-2 border-dashed border-border flex flex-col items-center justify-center space-y-6 hover:border-ink transition-all group cursor-pointer"
              >
                <div className="w-20 h-20 bg-paper flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-muted group-hover:text-ink" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-serif">Drop your research files</h3>
                  <p className="text-muted font-serif italic">RIS, BibTeX, CSV, or EndNote XML (Max 50MB)</p>
                </div>
                <button className="btn-editorial">Choose Files</button>
              </motion.div>
            )}

            {(state === 'uploading' || state === 'processing') && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {files.map((file, i) => (
                  <div key={i} className="bg-white p-8 border border-border shadow-editorial space-y-6">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <FileText className="w-8 h-8 text-muted" />
                        <div>
                          <h4 className="text-xl font-serif">{file.name}</h4>
                          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">{file.size} // {file.type}</span>
                        </div>
                      </div>
                      {state === 'processing' ? (
                        <div className="flex items-center gap-2 text-intel-blue">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="font-mono text-[10px] uppercase tracking-widest">Processing...</span>
                        </div>
                      ) : (
                        <span className="font-mono text-xs">{file.progress}%</span>
                      )}
                    </div>
                    <div className="h-1 bg-paper relative overflow-hidden">
                      <motion.div 
                        className="absolute left-0 top-0 h-full bg-ink"
                        animate={{ width: `${file.progress}%` }}
                      />
                    </div>
                  </div>
                ))}

                {state === 'processing' && (
                  <div className="p-8 bg-intel-blue/5 border border-intel-blue/20 flex gap-6">
                    <Sparkles className="w-6 h-6 text-intel-blue shrink-0" />
                    <div className="space-y-2">
                      <h4 className="font-serif font-bold italic text-intel-blue">AI-Assisted Parsing Active</h4>
                      <p className="text-sm text-intel-blue/80 font-serif leading-relaxed italic">
                        Our intelligence engine is extracting metadata and enriching your records from the global research corpus.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {state === 'completed' && (
              <motion.div 
                key="completed"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-white p-12 border-2 border-ink shadow-editorial text-center space-y-8"
              >
                <div className="w-20 h-20 bg-ink text-paper flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-4xl font-serif">Ingestion Complete</h3>
                  <p className="text-muted font-serif italic text-xl">1,248 records were successfully parsed and enriched.</p>
                </div>
                <div className="accent-line mx-auto w-24" />
                <div className="flex justify-center gap-4">
                  <button className="btn-editorial px-12">View Duplicate Candidates</button>
                  <button className="px-12 py-3 border border-border font-serif italic hover:bg-paper transition-all">Go to Screening</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="col-span-12 md:col-span-4 space-y-8">
          <div className="bg-ink text-paper p-8 space-y-6">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Lab Statistics</h3>
            <div className="space-y-4">
              <StatRow label="Total Ingested" value="0" />
              <StatRow label="Duplicate Candidates" value="0" />
              <StatRow label="Enrichment Matches" value="0" />
            </div>
            <div className="accent-line bg-white opacity-20" />
            <p className="text-xs font-serif italic text-paper/60 leading-relaxed">
              LitLens cross-references imports with OpenAlex and PubMed to ensure metadata integrity.
            </p>
          </div>

          <div className="p-8 border border-border space-y-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-muted flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> Technical Tips
            </h4>
            <ul className="text-xs font-serif italic text-muted space-y-3 list-disc pl-4">
              <li>Ensure your RIS files use standard UTF-8 encoding.</li>
              <li>Large imports (&gt;5,000 records) may take several minutes to enrich.</li>
              <li>You can merge multiple sources in one project.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="font-serif italic text-paper/80">{label}</span>
      <span className="font-mono text-xl font-bold">{value}</span>
    </div>
  );
}

function Sparkles(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

