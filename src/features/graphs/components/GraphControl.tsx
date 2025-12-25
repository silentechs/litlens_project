"use client";

import { cn } from "@/lib/utils";

export function GraphControl({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <button className="p-2 hover:bg-ink hover:text-paper transition-all group relative rounded-sm outline-none" title={label}>
      {icon}
    </button>
  );
}

