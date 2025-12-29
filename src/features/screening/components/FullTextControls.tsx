"use client";

import { useRef, useState } from "react";
import { FileText, UploadCloud, Download, Loader2, AlertTriangle, CheckCircle2, Eye, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FullTextViewerDialog } from "./FullTextViewerDialog";

interface FullTextControlsProps {
  projectId: string;
  projectWorkId: string;
  workUrl?: string | null;
  doi?: string | null;
  title?: string | null;
  pdfR2Key?: string | null;
  ingestionStatus?: string | null;
  ingestionError?: string | null;
  chunksCreated?: number | null;
  onChanged?: () => void;
}

function normalizeStatus(s?: string | null): string {
  return (s ?? "").toUpperCase();
}

function toSingleLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function toUserFacingIngestionError(raw: string): string {
  const msg = toSingleLine(raw);
  const lower = msg.toLowerCase();

  if (lower.includes("no pdf available") || lower.includes("doesn't look like a pdf")) {
    return "No full-text PDF could be retrieved from the study link. Upload the full-text PDF manually.";
  }

  if (lower.includes("redirect count exceeded") || lower.includes("too many redirects")) {
    return "The study link redirected too many times. Upload the full-text PDF manually.";
  }

  if (lower.includes("fetch failed")) {
    return "Could not fetch a PDF from the study link. Upload the full-text PDF manually.";
  }

  return msg;
}

function truncate(text: string, max = 180): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function FullTextControls({
  projectId,
  projectWorkId,
  workUrl,
  doi,
  title,
  pdfR2Key,
  ingestionStatus,
  ingestionError,
  chunksCreated,
  onChanged,
}: FullTextControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const status = normalizeStatus(ingestionStatus);
  const indexed = (chunksCreated ?? 0) > 0 && status === "COMPLETED";
  const hasPdf = !!pdfR2Key;
  const endNoteClickEnabled = process.env.NEXT_PUBLIC_ENDNOTE_CLICK_ENABLED === "true";
  const endNoteTargetUrl = workUrl || (doi ? `https://doi.org/${doi}` : null);

  const badgeLabel = indexed
    ? "Full text: indexed"
    : status === "PROCESSING"
      ? "Full text: indexing"
      : status === "PENDING"
        ? "Full text: queued"
        : hasPdf
          ? `Full text: ${status === "FAILED" ? "error" : "attached"}`
          : "Full text: missing";

  const badgeTone = indexed
    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
    : status === "FAILED"
      ? "bg-rose-50 border-rose-200 text-rose-800"
      : status === "PROCESSING" || status === "PENDING"
        ? "bg-amber-50 border-amber-200 text-amber-800"
      : "bg-white border-border text-muted hover:border-ink hover:text-ink";

  const openPicker = () => fileInputRef.current?.click();

  const upload = async (file: File) => {
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`/api/projects/${projectId}/works/${projectWorkId}/pdf`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message || "Upload failed");
      }

      toast.success("Full text uploaded. Indexing has been queued.");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const fetchFromLink = async () => {
    setIsFetching(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/works/${projectWorkId}/pdf/fetch`,
        { method: "POST", credentials: "include" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message || "Fetch queued failed");
      }
      toast.success("Fetch queued. The ingestion worker will try to retrieve the PDF.");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fetch queued failed");
    } finally {
      setIsFetching(false);
    }
  };

  const userFacingError =
    status === "FAILED" && ingestionError ? toUserFacingIngestionError(ingestionError) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={cn(
            "px-5 py-2.5 border text-[11px] font-mono uppercase tracking-widest rounded-full flex items-center gap-3 transition-all",
            badgeTone
          )}
          onClick={() => {
            if (userFacingError) toast.error(userFacingError);
          }}
          title={
            userFacingError
              ? userFacingError
              : status
                ? `Indexing status: ${status}`
                : undefined
          }
        >
          {indexed ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : status === "FAILED" ? (
            <AlertTriangle className="w-3.5 h-3.5" />
          ) : status === "PROCESSING" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileText className="w-3.5 h-3.5" />
          )}
          {badgeLabel}
        </button>

        {hasPdf && (
          <>
            <button
              type="button"
              onClick={() => setIsViewerOpen(true)}
              className={cn(
                "px-4 py-2 border rounded-full text-[11px] font-mono uppercase tracking-widest flex items-center gap-2 transition-all",
                "bg-white border-border hover:border-ink hover:text-ink text-muted"
              )}
              title="View the attached full-text PDF."
            >
              <Eye className="w-4 h-4" />
              View full text
            </button>
            <FullTextViewerDialog
              open={isViewerOpen}
              onOpenChange={setIsViewerOpen}
              projectId={projectId}
              projectWorkId={projectWorkId}
              title={title ?? undefined}
            />
          </>
        )}

        <button
          type="button"
          onClick={openPicker}
          disabled={isUploading}
          className={cn(
            "px-4 py-2 border rounded-full text-[11px] font-mono uppercase tracking-widest flex items-center gap-2 transition-all",
            "bg-white border-border hover:border-ink hover:text-ink text-muted",
            isUploading && "opacity-60 cursor-not-allowed"
          )}
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UploadCloud className="w-4 h-4" />
          )}
          Upload full text
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // allow re-select same file
            e.currentTarget.value = "";
            if (!file) return;
            void upload(file);
          }}
        />

        {!hasPdf && !!workUrl && (
          <button
            type="button"
            onClick={fetchFromLink}
            disabled={isFetching}
            className={cn(
              "px-4 py-2 border rounded-full text-[11px] font-mono uppercase tracking-widest flex items-center gap-2 transition-all",
              "bg-white border-border hover:border-ink hover:text-ink text-muted",
              isFetching && "opacity-60 cursor-not-allowed"
            )}
            title="Attempts to retrieve a PDF using the study's source link (open-access only)."
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Try fetch
          </button>
        )}

        {!hasPdf && endNoteClickEnabled && !!endNoteTargetUrl && (
          <button
            type="button"
            onClick={() => {
              window.open(endNoteTargetUrl, "_blank", "noopener,noreferrer");
              toast.info("Tip: if you have EndNote Click installed, use it on the opened page to download the PDF, then upload it here.");
            }}
            className={cn(
              "px-4 py-2 border rounded-full text-[11px] font-mono uppercase tracking-widest flex items-center gap-2 transition-all",
              "bg-white border-border hover:border-ink hover:text-ink text-muted"
            )}
            title="Open the study page/DOI in a new tab so EndNote Click can try to retrieve the PDF."
          >
            <ExternalLink className="w-4 h-4" />
            EndNote Click
          </button>
        )}
      </div>

      {userFacingError && (
        <div className="border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 rounded-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-widest">Indexing failed</p>
              <p className="text-sm font-serif italic leading-relaxed">{truncate(userFacingError)}</p>
            </div>
            <button
              type="button"
              onClick={() => toast.error(userFacingError)}
              className="text-[10px] font-mono uppercase tracking-widest text-rose-800/80 hover:text-rose-900 underline underline-offset-4"
            >
              Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


