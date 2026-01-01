import { cn } from "@/lib/utils";

export function MetadataBadge({ icon, label, variant = 'default' }: { icon: React.ReactNode, label: string, variant?: 'default' | 'intel' }) {
    return (
        <div className={cn(
            "px-5 py-2.5 border text-[11px] font-mono uppercase tracking-widest rounded-full flex items-center gap-3 transition-all",
            variant === 'intel'
                ? "bg-intel-blue/5 border-intel-blue/30 text-intel-blue shadow-sm"
                : "bg-white border-border text-muted hover:border-ink hover:text-ink"
        )}>
            {icon}
            {label}
        </div>
    );
}
