"use client";

import { useState, useEffect } from "react";
import { BookOpen, Target, GitCompare, TrendingUp, FileText, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface PICOSFormProps {
  projectId: string;
  initialData?: {
    population?: string | null;
    intervention?: string | null;
    comparison?: string | null;
    outcomes?: string | null;
    studyDesigns?: string[];
    includePreprints?: boolean;
    languageRestriction?: string[];
    yearMin?: number | null;
    yearMax?: number | null;
    customCriteria?: any;
  };
  onSave?: () => void;
  className?: string;
}

export function PICOSForm({
  projectId,
  initialData,
  onSave,
  className,
}: PICOSFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // PICOS fields
  const [population, setPopulation] = useState(initialData?.population || "");
  const [intervention, setIntervention] = useState(initialData?.intervention || "");
  const [comparison, setComparison] = useState(initialData?.comparison || "");
  const [outcomes, setOutcomes] = useState(initialData?.outcomes || "");

  // Additional criteria
  const [studyDesigns, setStudyDesigns] = useState(
    initialData?.studyDesigns?.join(", ") || ""
  );
  const [includePreprints, setIncludePreprints] = useState(
    initialData?.includePreprints || false
  );
  const [languages, setLanguages] = useState(
    initialData?.languageRestriction?.join(", ") || ""
  );
  const [yearMin, setYearMin] = useState(initialData?.yearMin?.toString() || "");
  const [yearMax, setYearMax] = useState(initialData?.yearMax?.toString() || "");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/eligibility-criteria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          population: population || null,
          intervention: intervention || null,
          comparison: comparison || null,
          outcomes: outcomes || null,
          studyDesigns: studyDesigns
            ? studyDesigns.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          includePreprints,
          languageRestriction: languages
            ? languages.split(",").map((l) => l.trim()).filter(Boolean)
            : [],
          yearMin: yearMin ? parseInt(yearMin) : null,
          yearMax: yearMax ? parseInt(yearMax) : null,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to save eligibility criteria");
      }

      toast.success("Eligibility criteria saved");
      onSave?.();
    } catch (error) {
      toast.error("Failed to save eligibility criteria");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    population !== (initialData?.population || "") ||
    intervention !== (initialData?.intervention || "") ||
    comparison !== (initialData?.comparison || "") ||
    outcomes !== (initialData?.outcomes || "") ||
    studyDesigns !== (initialData?.studyDesigns?.join(", ") || "") ||
    includePreprints !== (initialData?.includePreprints || false) ||
    languages !== (initialData?.languageRestriction?.join(", ") || "") ||
    yearMin !== (initialData?.yearMin?.toString() || "") ||
    yearMax !== (initialData?.yearMax?.toString() || "");

  return (
    <div className={cn("space-y-8", className)}>
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-serif font-bold flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-intel-blue" />
          Eligibility Criteria (PICOS)
        </h2>
        <p className="font-serif italic text-muted">
          Define your systematic review's inclusion and exclusion criteria using the PICOS framework.
        </p>
      </div>

      <div className="bg-white border border-border rounded-sm p-6 space-y-6">
        {/* Population */}
        <PICOSField
          icon={<Target className="w-4 h-4" />}
          label="Population (P)"
          description="Who are the participants or population of interest?"
          placeholder="e.g., Adults aged 18-65 with Type 2 Diabetes"
          value={population}
          onChange={setPopulation}
        />

        {/* Intervention */}
        <PICOSField
          icon={<TrendingUp className="w-4 h-4" />}
          label="Intervention (I)"
          description="What is the intervention, exposure, or treatment being studied?"
          placeholder="e.g., Metformin therapy, Cognitive Behavioral Therapy"
          value={intervention}
          onChange={setIntervention}
        />

        {/* Comparison */}
        <PICOSField
          icon={<GitCompare className="w-4 h-4" />}
          label="Comparison (C)"
          description="What is the comparison or control group?"
          placeholder="e.g., Placebo, Standard care, No intervention"
          value={comparison}
          onChange={setComparison}
        />

        {/* Outcomes */}
        <PICOSField
          icon={<Target className="w-4 h-4" />}
          label="Outcomes (O)"
          description="What are the primary and secondary outcomes of interest?"
          placeholder="e.g., HbA1c levels, Quality of life scores, Adverse events"
          value={outcomes}
          onChange={setOutcomes}
        />

        {/* Study Designs */}
        <PICOSField
          icon={<FileText className="w-4 h-4" />}
          label="Study Designs (S)"
          description="What study types are eligible? (comma-separated)"
          placeholder="e.g., RCT, Cohort Study, Case-Control"
          value={studyDesigns}
          onChange={setStudyDesigns}
          maxLength={200}
        />

        <div className="h-px bg-border my-6" />

        {/* Additional Criteria */}
        <div className="space-y-4">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted font-bold">
            Additional Criteria
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Year Range */}
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Publication Year Range
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="Min"
                  value={yearMin}
                  onChange={(e) => setYearMin(e.target.value)}
                  className="font-mono text-sm"
                  min={1900}
                  max={2100}
                />
                <span className="text-muted">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={yearMax}
                  onChange={(e) => setYearMax(e.target.value)}
                  className="font-mono text-sm"
                  min={1900}
                  max={2100}
                />
              </div>
            </div>

            {/* Languages */}
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Language Restrictions
              </label>
              <Input
                type="text"
                placeholder="e.g., English, Spanish, French"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                className="font-serif italic"
              />
            </div>
          </div>

          {/* Include Preprints */}
          <div className="flex items-center justify-between p-4 bg-paper rounded-sm">
            <div className="space-y-1">
              <label className="font-mono text-xs uppercase tracking-widest text-ink font-bold">
                Include Preprints
              </label>
              <p className="text-xs text-muted font-serif italic">
                Allow non-peer-reviewed preprints (e.g., arXiv, bioRxiv)
              </p>
            </div>
            <Switch
              checked={includePreprints}
              onCheckedChange={setIncludePreprints}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="bg-intel-blue text-white hover:bg-intel-blue/90 font-mono text-xs uppercase tracking-widest min-w-[140px]"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Criteria
            </>
          )}
        </Button>
      </div>

      {/* Helper Text */}
      <div className="text-xs font-serif italic text-muted bg-paper p-4 rounded-sm border border-border">
        <strong>Tip:</strong> Clearly defined eligibility criteria help ensure consistent screening
        decisions and reduce conflicts between reviewers. These criteria will be visible to all
        team members during screening.
      </div>
    </div>
  );
}

interface PICOSFieldProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

function PICOSField({
  icon,
  label,
  description,
  placeholder,
  value,
  onChange,
  maxLength = 1000,
}: PICOSFieldProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-intel-blue">{icon}</div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-ink font-bold">
          {label}
        </label>
      </div>
      <p className="text-xs text-muted font-serif italic pl-6">{description}</p>
      <Textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-serif italic min-h-[80px] resize-none"
        maxLength={maxLength}
      />
      {value && (
        <div className="text-right text-[10px] font-mono text-muted">
          {value.length} / {maxLength}
        </div>
      )}
    </div>
  );
}

