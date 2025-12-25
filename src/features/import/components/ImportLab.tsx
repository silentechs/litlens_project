"use client";

import { useState } from "react";
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
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type ImportState = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

interface FileInfo {
  name: string;
  size: string;
  type: string;
  progress: number;
}

interface ImportResult {
  processed: number;
  duplicates: number;
  errors: number;
  newWorks: number;
}

export function ImportLab() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const queryClient = useQueryClient();

  const [state, setState] = useState<ImportState>('idle');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const steps = [
    { label: 'Upload Sources', icon: <Upload className="w-4 h-4" /> },
    { label: 'Ingestion', icon: <Database className="w-4 h-4" /> },
    { label: 'Deduplication', icon: <Search className="w-4 h-4" /> },
  ];

  // 1. Get Presigned URL
  const getUploadUrlMutation = useMutation({
    mutationFn: async ({ filename, contentType }: { filename: string; contentType: string }) => {
      const res = await fetch(`/api/upload?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}&folder=imports`);
      if (!res.ok) throw new Error("Failed to get upload URL");
      return res.json();
    }
  });

  // 2. Start Import Process (After R2 upload)
  const startImportMutation = useMutation({
    mutationFn: async ({ key, filename, fileSize, fileType }: { key: string, filename: string, fileSize: number, fileType: string }) => {
      const res = await fetch(`/api/projects/${projectId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, filename, fileSize, fileType }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Import failed");
      }

      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate project stats
      queryClient.invalidateQueries({ queryKey: ["projects", "detail", projectId] });

      setResult({
        processed: data.data.processedRecords || 0,
        duplicates: data.data.duplicatesFound || 0,
        errors: data.data.errorsCount || 0,
        newWorks: (data.data.processedRecords || 0) - (data.data.duplicatesFound || 0),
      });
      setState('completed');
      setActiveStep(2);
    },
    onError: (error) => {
      setState('error');
      toast.error(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });

  const handleFileDrop = async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();

    let file: File | null = null;
    if ('dataTransfer' in e) { // DragEvent
      // @ts-ignore - TS doesn't narrow cleanly here
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        // @ts-ignore
        file = e.dataTransfer.files[0];
      }
    } else if ('target' in e && e.target.files && e.target.files.length > 0) { // ChangeEvent
      file = e.target.files[0];
    }

    if (!file) return;

    // Validate type
    const validExts = ['ris', 'bib', 'bibtex', 'csv', 'xml', 'nbib', 'txt'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!validExts.includes(ext)) {
      toast.error("Unsupported file type. Please upload RIS, BibTeX, PubMED (nbib), or CSV.");
      return;
    }

    setState('uploading');
    setFiles([{
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + " MB",
      type: ext.toUpperCase(),
      progress: 0
    }]);

    try {
      // 1. Get URL
      const { data: uploadConfig } = await getUploadUrlMutation.mutateAsync({
        filename: file.name,
        contentType: file.type || 'text/plain'
      });

      // 2. Upload to R2
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadConfig.uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'text/plain');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setFiles(prev => [{ ...prev[0], progress: percentComplete }]);
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          setState('processing');
          setActiveStep(1);

          // 3. Trigger Import
          startImportMutation.mutate({
            key: uploadConfig.key,
            filename: file.name,
            fileSize: file.size,
            fileType: ext
          });
        } else {
          setState('error');
          toast.error("Upload to storage failed.");
        }
      };

      xhr.onerror = () => {
        setState('error');
        toast.error("Network error during upload.");
      };

      xhr.send(file);

    } catch (error) {
      console.error(error);
      setState('error');
      toast.error("Failed to initiate upload.");
    }
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
                className="h-[400px] border-2 border-dashed border-border flex flex-col items-center justify-center space-y-6 hover:border-ink transition-all group cursor-pointer relative"
              >
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleFileDrop}
                  accept=".ris,.bib,.txt,.csv,.nbib,.xml"
                />
                <div className="w-20 h-20 bg-paper flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-muted group-hover:text-ink" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-serif">Drop your research files</h3>
                  <p className="text-muted font-serif italic">RIS, BibTeX, CSV, or EndNote XML (Max 50MB)</p>
                </div>
                <button className="btn-editorial pointer-events-none">Choose Files</button>
              </motion.div>
            )}

            {(state === 'uploading' || state === 'processing' || state === 'error') && (
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

                {state === 'error' && (
                  <div className="p-8 bg-rose-50 border border-rose-200 flex gap-6">
                    <AlertCircle className="w-6 h-6 text-rose-500 shrink-0" />
                    <div className="space-y-2">
                      <h4 className="font-serif font-bold italic text-rose-600">Import Failed</h4>
                      <button onClick={() => setState('idle')} className="text-sm underline">Try again</button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {state === 'completed' && result && (
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
                  <p className="text-muted font-serif italic text-xl">
                    {result.processed} records were successfully parsed an enriched.
                  </p>
                </div>
                <div className="accent-line mx-auto w-24" />
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => router.push(`/project/${projectId}/duplicates`)}
                    className="btn-editorial px-12"
                  >
                    View {result.duplicates} Duplicate Candidates
                  </button>
                  <button
                    onClick={() => router.push(`/project/${projectId}/screening`)}
                    className="px-12 py-3 border border-border font-serif italic hover:bg-paper transition-all"
                  >
                    Go to Screening
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="col-span-12 md:col-span-4 space-y-8">
          <div className="bg-ink text-paper p-8 space-y-6">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Lab Statistics</h3>
            <div className="space-y-4">
              <StatRow label="Total Ingested" value={result?.processed.toString() || "0"} />
              <StatRow label="Duplicate Candidates" value={result?.duplicates.toString() || "0"} />
              <StatRow label="Enrichment Matches" value={result?.newWorks.toString() || "0"} />
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
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
