"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="min-h-screen flex items-center justify-center bg-paper">
                    <ErrorState
                        title="System Error"
                        description="A critical system error occurred. Our team has been notified."
                        retry={reset}
                    />
                </div>
            </body>
        </html>
    );
}
