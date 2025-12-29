"use client";

import { useState } from "react";
import { Search, Sparkles, SortAsc, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ScreeningFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  filterDecision?: string;
  onFilterDecisionChange: (value: string | undefined) => void;
  onClearFilters: () => void;
  className?: string;
}

const SORT_OPTIONS = [
  { value: "aiConfidence", label: "Most Relevant (AI)", icon: "✨" },
  { value: "priorityScore", label: "Priority Score", icon: "⭐" },
  { value: "createdAt", label: "Most Recent", icon: "🕐" },
  { value: "title", label: "Title (A-Z)", icon: "📝" },
  { value: "year", label: "Publication Year", icon: "📅" },
];

const DECISION_FILTERS = [
  { value: "all", label: "All Studies" },
  { value: "PENDING", label: "Not Yet Reviewed" },
  { value: "INCLUDE", label: "Included" },
  { value: "EXCLUDE", label: "Excluded" },
  { value: "MAYBE", label: "Maybe" },
];

export function ScreeningFilters({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  filterDecision,
  onFilterDecisionChange,
  onClearFilters,
  className,
}: ScreeningFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = searchTerm || filterDecision || sortBy !== "aiConfidence";

  return (
    <div className={cn("space-y-4", className)}>
      {/* Primary Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <Input
            type="text"
            placeholder="Search by title, abstract, or authors..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 font-serif italic"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort By */}
        <div className="flex items-center gap-2">
          <SortAsc className="w-4 h-4 text-muted" />
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-[200px] font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="font-mono text-xs"
                >
                  <span className="flex items-center gap-2">
                    <span>{option.icon}</span>
                    {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "font-mono text-xs uppercase tracking-widest",
            showFilters && "bg-ink text-paper"
          )}
        >
          <Filter className="w-3 h-3 mr-2" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 w-1.5 h-1.5 rounded-full bg-intel-blue" />
          )}
        </Button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="font-mono text-[10px] uppercase tracking-widest text-muted"
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="bg-white border border-border rounded-sm p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted font-bold">
              Filter by Decision
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {DECISION_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() =>
                    onFilterDecisionChange(
                      filter.value === "all" ? undefined : filter.value
                    )
                  }
                  className={cn(
                    "px-4 py-2 border rounded-sm font-serif italic text-sm transition-all",
                    (filter.value === "all" && !filterDecision) ||
                      filterDecision === filter.value
                      ? "bg-ink text-paper border-ink shadow-editorial"
                      : "bg-white text-ink border-border hover:border-ink"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Confidence indicator if using AI sort */}
          {sortBy === "aiConfidence" && (
            <div className="flex items-start gap-3 p-4 bg-intel-blue/5 border border-intel-blue/20 rounded-sm">
              <Sparkles className="w-5 h-5 text-intel-blue flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-mono text-[10px] uppercase tracking-widest text-intel-blue font-bold">
                  AI-Powered Sorting Active
                </div>
                <div className="font-serif italic text-sm text-muted leading-relaxed">
                  Studies are ordered by relevance prediction. The AI model learns from your decisions
                  to improve accuracy over time.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

