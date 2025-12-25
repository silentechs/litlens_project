"use client";

import { cn } from "@/lib/utils";

export function GraphNode({ 
  x, 
  y, 
  size, 
  label, 
  active, 
  onClick 
}: { 
  id: string, 
  x: string, 
  y: string, 
  size: 'lg' | 'md' | 'sm', 
  label: string, 
  active?: boolean, 
  onClick: () => void 
}) {
  const sizes = {
    lg: "w-8 h-8",
    md: "w-5 h-5",
    sm: "w-3 h-3"
  };

  return (
    <div 
      className="absolute flex flex-col items-center gap-2 pointer-events-auto cursor-pointer group z-10"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
      onClick={onClick}
    >
      <div className={cn(
        "rounded-full transition-all duration-500 shadow-sm",
        sizes[size],
        active ? "bg-intel-blue ring-8 ring-intel-blue/10 scale-125" : "bg-ink group-hover:bg-intel-blue group-hover:ring-4 group-hover:ring-intel-blue/5"
      )} />
      <span className={cn(
        "whitespace-nowrap font-serif italic text-[10px] opacity-0 group-hover:opacity-100 transition-all absolute top-full mt-2 bg-white/90 backdrop-blur-sm px-2 py-1 border border-border shadow-sm pointer-events-none",
        active && "opacity-100 text-intel-blue font-bold border-intel-blue/30 scale-110"
      )}>
        {label}
      </span>
    </div>
  );
}

