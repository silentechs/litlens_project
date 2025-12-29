"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function ErrorPage({
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
    <div className="h-full flex items-center justify-center">
      <ErrorState
        title="Application Error"
        description={error.message || "An unexpected error occurred in the application."}
        retry={reset}
      />
    </div>
  );
}
