"use client";

import { cn } from "@/lib/utils";

export function GraphLegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-2 h-2 rounded-full", color)} />
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted">{label}</span>
    </div>
  );
}

