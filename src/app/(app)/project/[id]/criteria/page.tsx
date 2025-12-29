"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface PageProps {
    params: Promise<{ id: string }>;
}

interface EligibilityCriteria {
    population?: string | null;
    intervention?: string | null;
    comparison?: string | null;
    outcomes?: string | null;
    studyDesigns: string[];
    includePreprints: boolean;
    languageRestriction: string[];
    yearMin?: number | null;
    yearMax?: number | null;
}

const STUDY_DESIGNS = [
    "Randomized Controlled Trial",
    "Cohort Study",
    "Case-Control Study",
    "Cross-Sectional Study",
    "Systematic Review",
    "Meta-Analysis",
    "Qualitative Study",
    "Mixed Methods",
];

export default function EligibilityCriteriaPage({ params }: PageProps) {
    const { id: projectId } = use(params);
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [criteria, setCriteria] = useState<EligibilityCriteria>({
        population: "",
        intervention: "",
        comparison: "",
        outcomes: "",
        studyDesigns: [],
        includePreprints: false,
        languageRestriction: [],
        yearMin: null,
        yearMax: null,
    });

    useEffect(() => {
        async function fetchCriteria() {
            try {
                const response = await fetch(`/api/projects/${projectId}/eligibility-criteria`);
                const data = await response.json();
                if (data.data?.exists && data.data?.criteria) {
                    setCriteria(data.data.criteria);
                }
            } catch (error) {
                console.error("Failed to fetch criteria:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchCriteria();
    }, [projectId]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/eligibility-criteria`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(criteria),
            });

            if (!response.ok) {
                throw new Error("Failed to save criteria");
            }

            toast.success("Eligibility criteria saved successfully");
            router.push(`/project/${projectId}/screening`);
        } catch (error) {
            toast.error("Failed to save eligibility criteria");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStudyDesign = (design: string) => {
        setCriteria(prev => ({
            ...prev,
            studyDesigns: prev.studyDesigns.includes(design)
                ? prev.studyDesigns.filter(d => d !== design)
                : [...prev.studyDesigns, design],
        }));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Eligibility Criteria</h1>
                        <p className="text-muted-foreground">Define PICOS criteria for systematic screening</p>
                    </div>
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Criteria
                </Button>
            </div>

            {/* PICOS Section */}
            <div className="bg-card border rounded-xl p-6 space-y-6">
                <h2 className="text-lg font-semibold">PICOS Framework</h2>

                <div className="grid gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="population">Population</Label>
                        <Textarea
                            id="population"
                            placeholder="e.g., Adults aged 18+ with type 2 diabetes"
                            value={criteria.population || ""}
                            onChange={(e) => setCriteria({ ...criteria, population: e.target.value })}
                            rows={2}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="intervention">Intervention</Label>
                        <Textarea
                            id="intervention"
                            placeholder="e.g., Cognitive behavioral therapy (CBT)"
                            value={criteria.intervention || ""}
                            onChange={(e) => setCriteria({ ...criteria, intervention: e.target.value })}
                            rows={2}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="comparison">Comparison</Label>
                        <Textarea
                            id="comparison"
                            placeholder="e.g., Standard care, placebo, or no intervention"
                            value={criteria.comparison || ""}
                            onChange={(e) => setCriteria({ ...criteria, comparison: e.target.value })}
                            rows={2}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="outcomes">Outcomes</Label>
                        <Textarea
                            id="outcomes"
                            placeholder="e.g., Blood glucose levels, HbA1c, quality of life"
                            value={criteria.outcomes || ""}
                            onChange={(e) => setCriteria({ ...criteria, outcomes: e.target.value })}
                            rows={2}
                        />
                    </div>
                </div>
            </div>

            {/* Study Design Section */}
            <div className="bg-card border rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-semibold">Study Designs</h2>
                <p className="text-sm text-muted-foreground">Select which study designs to include</p>
                <div className="flex flex-wrap gap-2">
                    {STUDY_DESIGNS.map((design) => (
                        <button
                            key={design}
                            onClick={() => toggleStudyDesign(design)}
                            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${criteria.studyDesigns.includes(design)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                                }`}
                        >
                            {design}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-card border rounded-xl p-6 space-y-6">
                <h2 className="text-lg font-semibold">Additional Filters</h2>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="yearMin">Publication Year (Min)</Label>
                        <Input
                            id="yearMin"
                            type="number"
                            placeholder="e.g., 2010"
                            value={criteria.yearMin || ""}
                            onChange={(e) => setCriteria({ ...criteria, yearMin: e.target.value ? parseInt(e.target.value) : null })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="yearMax">Publication Year (Max)</Label>
                        <Input
                            id="yearMax"
                            type="number"
                            placeholder="e.g., 2024"
                            value={criteria.yearMax || ""}
                            onChange={(e) => setCriteria({ ...criteria, yearMax: e.target.value ? parseInt(e.target.value) : null })}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Label htmlFor="preprints">Include Preprints</Label>
                        <p className="text-sm text-muted-foreground">Allow non-peer-reviewed preprints</p>
                    </div>
                    <Switch
                        id="preprints"
                        checked={criteria.includePreprints}
                        onCheckedChange={(checked) => setCriteria({ ...criteria, includePreprints: checked })}
                    />
                </div>
            </div>
        </div>
    );
}
