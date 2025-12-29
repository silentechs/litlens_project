"use client";

import { useState } from "react";
import { Plus, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface KeywordManagerProps {
  keywords: string[];
  onUpdate: (keywords: string[]) => Promise<void>;
  className?: string;
}

export function KeywordManager({
  keywords,
  onUpdate,
  className,
}: KeywordManagerProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async () => {
    const keyword = newKeyword.trim();
    if (!keyword) return;

    if (keywords.includes(keyword)) {
      toast.error("This keyword already exists");
      return;
    }

    setIsLoading(true);
    try {
      await onUpdate([...keywords, keyword]);
      setNewKeyword("");
      toast.success("Keyword added");
    } catch (error) {
      toast.error("Failed to add keyword");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (keyword: string) => {
    setIsLoading(true);
    try {
      await onUpdate(keywords.filter((k) => k !== keyword));
      toast.success("Keyword removed");
    } catch (error) {
      toast.error("Failed to remove keyword");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-intel-blue flex-shrink-0 mt-2" />
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted font-bold">
              Highlight Keywords
            </h3>
            <p className="font-serif italic text-sm text-muted mt-1">
              Important terms will be highlighted in titles and abstracts during screening
            </p>
          </div>

          {/* Add Keyword */}
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Add keyword (e.g., COVID-19, systematic review)"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1 font-serif italic"
            />
            <Button
              onClick={handleAdd}
              disabled={!newKeyword.trim() || isLoading}
              className="bg-intel-blue text-white hover:bg-intel-blue/90 font-mono text-xs uppercase tracking-widest"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Keyword List */}
          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <div
                  key={keyword}
                  className="group flex items-center gap-2 px-3 py-1.5 bg-intel-blue/10 border border-intel-blue/30 rounded-full text-sm font-serif italic hover:bg-intel-blue/20 transition-colors"
                >
                  <span className="text-intel-blue">{keyword}</span>
                  <button
                    onClick={() => handleRemove(keyword)}
                    disabled={isLoading}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-intel-blue hover:text-intel-blue/70 disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-border rounded-sm">
              <Sparkles className="w-8 h-8 mx-auto text-muted opacity-20 mb-2" />
              <p className="font-serif italic text-sm text-muted">
                No keywords added yet. Add keywords to highlight them during screening.
              </p>
            </div>
          )}

          {/* Helpful Tips */}
          <div className="text-xs font-serif italic text-muted bg-paper p-3 rounded-sm border border-border">
            <strong>Tip:</strong> Use specific medical terms, population names, or intervention types
            that indicate study relevance (e.g., "randomized", "placebo", "meta-analysis")
          </div>
        </div>
      </div>
    </div>
  );
}

