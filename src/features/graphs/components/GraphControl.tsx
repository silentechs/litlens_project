"use client";

import { cn } from "@/lib/utils";

interface GraphControlProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function GraphControl({ icon, label, onClick, disabled }: GraphControlProps) {
  return (
    <button 
      className={cn(
        "p-2 hover:bg-ink hover:text-paper transition-all group relative rounded-sm outline-none",
        disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-current"
      )}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </button>
  );
}

