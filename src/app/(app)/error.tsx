"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function Error({
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
    <div className="min-h-[600px] flex flex-col items-center justify-center text-center space-y-8 p-12">
      <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-10 h-10 text-rose-500" />
      </div>
      
      <header className="space-y-4">
        <h2 className="text-4xl font-serif">Something went wrong</h2>
        <p className="text-muted font-serif italic text-xl max-w-md mx-auto">
          We encountered an unexpected discrepancy in our intelligence engine.
        </p>
        {error.digest && (
          <p className="font-mono text-[10px] uppercase text-muted tracking-widest">
            Error ID: {error.digest}
          </p>
        )}
      </header>
      
      <div className="accent-line w-24 mx-auto" />
      
      <button 
        onClick={() => reset()}
        className="btn-editorial flex items-center gap-2"
      >
        <RefreshCcw className="w-4 h-4" />
        Attempt Recovery
      </button>
    </div>
  );
}

