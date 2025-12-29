"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Target, TrendingUp, GitCompare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface EligibilityCriteriaPanelProps {
  criteria: {
    population?: string | null;
    intervention?: string | null;
    comparison?: string | null;
    outcomes?: string | null;
    studyDesigns?: string[];
    includePreprints?: boolean;
    languageRestriction?: string[];
    yearMin?: number | null;
    yearMax?: number | null;
  } | null;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

export function EligibilityCriteriaPanel({
  criteria,
  collapsible = true,
  defaultCollapsed = false,
  className,
}: EligibilityCriteriaPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  if (!criteria) {
    return (
      <div className={cn("p-6 bg-paper border border-dashed border-border rounded-sm text-center", className)}>
        <BookOpen className="w-8 h-8 mx-auto text-muted opacity-20 mb-3" />
        <p className="font-serif italic text-sm text-muted">
          No eligibility criteria defined yet.
        </p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted mt-2">
          Set criteria in project settings
        </p>
      </div>
    );
  }

  const hasAnyPICOS = !!(
    criteria.population ||
    criteria.intervention ||
    criteria.comparison ||
    criteria.outcomes
  );

  return (
    <div className={cn("bg-white border border-border rounded-sm overflow-hidden", className)}>
      {/* Header */}
      <button
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
        className={cn(
          "w-full flex items-center justify-between p-4 bg-intel-blue/5 hover:bg-intel-blue/10 transition-colors",
          !collapsible && "cursor-default"
        )}
        disabled={!collapsible}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-intel-blue" />
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink font-bold">
            Eligibility Criteria
          </h3>
        </div>
        {collapsible && (
          <div>
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-muted" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted" />
            )}
          </div>
        )}
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-6 space-y-6">
          {/* PICOS Section */}
          {hasAnyPICOS && (
            <div className="space-y-4">
              {criteria.population && (
                <CriteriaItem
                  icon={<Target className="w-3.5 h-3.5" />}
                  label="Population"
                  content={criteria.population}
                />
              )}
              {criteria.intervention && (
                <CriteriaItem
                  icon={<TrendingUp className="w-3.5 h-3.5" />}
                  label="Intervention"
                  content={criteria.intervention}
                />
              )}
              {criteria.comparison && (
                <CriteriaItem
                  icon={<GitCompare className="w-3.5 h-3.5" />}
                  label="Comparison"
                  content={criteria.comparison}
                />
              )}
              {criteria.outcomes && (
                <CriteriaItem
                  icon={<Target className="w-3.5 h-3.5" />}
                  label="Outcomes"
                  content={criteria.outcomes}
                />
              )}
              {criteria.studyDesigns && criteria.studyDesigns.length > 0 && (
                <CriteriaItem
                  icon={<FileText className="w-3.5 h-3.5" />}
                  label="Study Designs"
                  content={criteria.studyDesigns.join(", ")}
                />
              )}
            </div>
          )}

          {/* Additional Criteria */}
          {(criteria.yearMin ||
            criteria.yearMax ||
            criteria.languageRestriction?.length ||
            criteria.includePreprints) && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-3">
                <h4 className="font-mono text-[9px] uppercase tracking-widest text-muted font-bold">
                  Additional Filters
                </h4>

                {(criteria.yearMin || criteria.yearMax) && (
                  <div className="text-sm">
                    <span className="font-mono text-xs text-muted">Year Range: </span>
                    <span className="font-serif italic text-ink">
                      {criteria.yearMin || "Any"} - {criteria.yearMax || "Present"}
                    </span>
                  </div>
                )}

                {criteria.languageRestriction && criteria.languageRestriction.length > 0 && (
                  <div className="text-sm">
                    <span className="font-mono text-xs text-muted">Languages: </span>
                    <span className="font-serif italic text-ink">
                      {criteria.languageRestriction.join(", ")}
                    </span>
                  </div>
                )}

                {criteria.includePreprints && (
                  <div className="text-sm">
                    <span className="font-serif italic text-ink">Preprints included</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface CriteriaItemProps {
  icon: React.ReactNode;
  label: string;
  content: string;
}

function CriteriaItem({ icon, label, content }: CriteriaItemProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-intel-blue">
        {icon}
        <span className="font-mono text-[9px] uppercase tracking-widest font-bold">
          {label}
        </span>
      </div>
      <p className="font-serif italic text-sm text-ink leading-relaxed pl-6">
        {content}
      </p>
    </div>
  );
}

