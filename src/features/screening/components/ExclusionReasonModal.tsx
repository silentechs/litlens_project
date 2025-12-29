"use client";

import { useState, useEffect, useCallback } from "react";
import { X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ExclusionReasonInputs } from "./ExclusionReasonInputs";
import { Button } from "@/components/ui/button";

interface ExclusionReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  studyTitle?: string;
  isSubmitting?: boolean;
}

export function ExclusionReasonModal({
  isOpen,
  onClose,
  onConfirm,
  studyTitle,
  isSubmitting = false,
}: ExclusionReasonModalProps) {
  const [reason, setReason] = useState("");

  // Reset reason when modal opens
  useEffect(() => {
    if (isOpen) {
      setReason("");
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleConfirm = useCallback(() => {
    if (reason.trim()) {
      onConfirm(reason.trim());
    }
  }, [reason, onConfirm]);

  // Handle enter key to confirm (when reason is filled)
  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter" && isOpen && reason.trim() && !isSubmitting) {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener("keydown", handleEnter);
    return () => window.removeEventListener("keydown", handleEnter);
  }, [isOpen, reason, isSubmitting, handleConfirm]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-md bg-white border border-border rounded-lg shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border bg-rose-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h2 className="font-serif text-xl text-ink">Exclude Study</h2>
                    <p className="text-xs text-muted font-mono uppercase tracking-wider">
                      Reason required
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="p-2 hover:bg-rose-100 rounded-full transition-colors text-muted hover:text-ink disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {studyTitle && (
                  <div className="p-4 bg-paper border border-border/50 rounded-sm">
                    <p className="text-xs text-muted font-mono uppercase tracking-wider mb-2">
                      Excluding
                    </p>
                    <p className="font-serif text-sm text-ink line-clamp-2 italic">
                      {studyTitle}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Please select or provide a reason for excluding this study. This helps
                    maintain transparency and reproducibility in your review.
                  </p>

                  <ExclusionReasonInputs value={reason} onChange={setReason} />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-paper/50">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="font-mono text-xs uppercase tracking-wider"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!reason.trim() || isSubmitting}
                  className={cn(
                    "bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs uppercase tracking-wider",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Excluding...
                    </span>
                  ) : (
                    "Confirm Exclusion"
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

