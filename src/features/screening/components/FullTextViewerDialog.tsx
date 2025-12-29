"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FullTextLinkPayload = {
  url: string;
  expiresIn: number;
  pdfR2Key: string;
  pdfUploadedAt: string | null;
  pdfFileSize: number | null;
  pdfSource: string | null;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Failed to load full-text PDF";
}

export function FullTextViewerDialog({
  open,
  onOpenChange,
  projectId,
  projectWorkId,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectWorkId: string;
  title?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<FullTextLinkPayload | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const downloadUrl = payload?.url ?? null;

  const subtitle = useMemo(() => {
    if (!payload) return null;
    const bits: string[] = [];
    if (payload.pdfSource) bits.push(`source: ${payload.pdfSource}`);
    if (payload.pdfFileSize) bits.push(`${Math.round(payload.pdfFileSize / 1024 / 1024)} MB`);
    bits.push(`link expires in ~${Math.round(payload.expiresIn / 60)}m`);
    return bits.join(" • ");
  }, [payload]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/works/${projectWorkId}/pdf`, {
          method: "GET",
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error?.message || "Failed to get PDF link");
        }
        const data = json?.data as FullTextLinkPayload | undefined;
        if (!data?.url) {
          throw new Error("PDF link is unavailable");
        }
        if (!cancelled) setPayload(data);
      } catch (e) {
        const msg = getErrorMessage(e);
        if (!cancelled) {
          setPayload(null);
          setError(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, projectWorkId, refreshKey]);

  const openInNewTab = () => {
    if (!downloadUrl) return;
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  };

  const refresh = () => setRefreshKey((v) => v + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border/60">
            <DialogHeader className="text-left">
              <DialogTitle>Full-text PDF</DialogTitle>
              <DialogDescription className="text-muted">
                {title ? (
                  <span className="block">
                    <span className="font-serif italic text-ink/90">{title}</span>
                    {subtitle ? <span className="block mt-1">{subtitle}</span> : null}
                  </span>
                ) : subtitle ? (
                  subtitle
                ) : (
                  "View or download the attached full-text PDF."
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-3 border-b border-border/50 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openInNewTab}
                disabled={!downloadUrl || isLoading}
                className={cn(
                  "px-4 py-2 border rounded-full text-[11px] font-mono uppercase tracking-widest flex items-center gap-2 transition-all",
                  "bg-white border-border hover:border-ink hover:text-ink text-muted",
                  (!downloadUrl || isLoading) && "opacity-60 cursor-not-allowed"
                )}
              >
                <ExternalLink className="w-4 h-4" />
                Open in new tab
              </button>

              <button
                type="button"
                onClick={refresh}
                disabled={isLoading}
                className={cn(
                  "px-4 py-2 border rounded-full text-[11px] font-mono uppercase tracking-widest flex items-center gap-2 transition-all",
                  "bg-white border-border hover:border-ink hover:text-ink text-muted",
                  isLoading && "opacity-60 cursor-not-allowed"
                )}
                title="Refresh the signed link (useful if it expired)."
              >
                <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                Refresh link
              </button>
            </div>

            {error ? (
              <button
                type="button"
                onClick={() => toast.error(error)}
                className="text-[10px] font-mono uppercase tracking-widest text-rose-700 hover:text-rose-900 underline underline-offset-4"
              >
                Details
              </button>
            ) : null}
          </div>

          <div className="flex-1 bg-white">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-muted">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="font-serif italic">Loading full text…</p>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
                <AlertTriangle className="w-8 h-8 text-rose-600" />
                <p className="font-serif italic text-ink/80">{error}</p>
                <button
                  type="button"
                  onClick={refresh}
                  className="px-4 py-2 border rounded-full text-[11px] font-mono uppercase tracking-widest bg-white border-border hover:border-ink hover:text-ink text-muted transition-all"
                >
                  Try again
                </button>
              </div>
            ) : downloadUrl ? (
              <iframe
                key={downloadUrl}
                title="Full-text PDF"
                src={downloadUrl}
                className="w-full h-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted">
                <p className="font-serif italic">No PDF is attached.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


