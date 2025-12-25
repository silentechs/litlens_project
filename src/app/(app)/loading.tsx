import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center space-y-6">
      <div className="relative">
        <Loader2 className="w-12 h-12 text-ink animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-intel-blue rounded-full animate-pulse" />
        </div>
      </div>
      <div className="space-y-2 text-center">
        <p className="font-serif italic text-lg text-muted animate-pulse">Synthesizing intelligence...</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted/40">Editorial Mode Active</span>
      </div>
    </div>
  );
}

