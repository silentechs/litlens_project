"use client";

import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ErrorStateProps {
    title?: string;
    description?: string;
    retry?: () => void;
    homeHash?: string;
}

export function ErrorState({
    title = "Something went wrong",
    description = "We encountered an unexpected error. Please try again or contact support if the issue persists.",
    retry,
}: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>

            <h2 className="text-3xl font-serif font-bold text-ink mb-3">{title}</h2>
            <p className="text-muted font-serif italic text-lg max-w-md mb-8 leading-relaxed">
                {description}
            </p>

            <div className="flex items-center gap-4">
                <Button variant="outline" asChild>
                    <Link href="/dashboard">
                        <Home className="w-4 h-4 mr-2" />
                        Home
                    </Link>
                </Button>

                {retry && (
                    <Button onClick={retry} className="bg-ink text-white hover:bg-ink/90">
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Try Again
                    </Button>
                )}
            </div>
        </div>
    );
}
