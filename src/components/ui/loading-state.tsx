"use client";

import { Loader2 } from "lucide-react";

interface LoadingStateProps {
    title?: string;
    description?: string;
    className?: string;
}

export function LoadingState({
    title = "Loading...",
    description,
    className
}: LoadingStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center min-h-[400px] p-8 text-center animate-in fade-in duration-500 ${className}`}>
            <Loader2 className="w-10 h-10 text-intel-blue animate-spin mb-6" />
            <h2 className="text-2xl font-serif font-bold text-ink mb-2">{title}</h2>
            {description && (
                <p className="text-muted font-serif italic text-lg max-w-md leading-relaxed">
                    {description}
                </p>
            )}
        </div>
    );
}
