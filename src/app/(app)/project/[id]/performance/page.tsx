"use client";

import { use } from "react";
import { ScreeningAnalytics } from "@/features/screening/components/ScreeningAnalytics";

export default function PerformancePage({ params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = use(params);

    return (
        <div className="space-y-8 max-w-7xl mx-auto px-6 py-8">
            <header>
                <h1 className="text-3xl font-bold">Reviewer Performance</h1>
                <p className="text-muted-foreground mt-2">
                    Track screening velocity, inter-rater agreement, and team performance metrics.
                </p>
            </header>
            <ScreeningAnalytics projectId={projectId} />
        </div>
    );
}
