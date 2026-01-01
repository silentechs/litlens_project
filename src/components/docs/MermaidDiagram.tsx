"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { cn } from "@/lib/utils";

mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
        fontFamily: "var(--font-sans)",
        primaryColor: "#ffffff",
        primaryTextColor: "#000000",
        primaryBorderColor: "#e5e7eb",
        lineColor: "#f4f4f5", // zinc-100
        secondaryColor: "#18181b", // zinc-900
        tertiaryColor: "#ffffff",
    },
    securityLevel: "loose",
});

interface MermaidDiagramProps {
    chart: string;
    className?: string;
}

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!chart) return;

        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;

        mermaid
            .render(id, chart)
            .then(({ svg }) => {
                setSvg(svg);
                setError(null);
            })
            .catch((err) => {
                console.error("Mermaid render error:", err);
                setError("Failed to render diagram");
            });
    }, [chart]);

    if (error) {
        return (
            <div className="p-4 border border-rose-200 bg-rose-50 text-rose-800 rounded-sm font-mono text-xs">
                {error}
            </div>
        );
    }

    return (
        <div
            ref={ref}
            className={cn(
                "mermaid-diagram flex justify-center p-6 bg-zinc-950/50 rounded-lg border border-white/10 overflow-x-auto",
                className
            )}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}
