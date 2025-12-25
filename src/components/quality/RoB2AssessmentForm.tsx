"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    AlertCircle,
    CheckCircle2,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    Save,
} from "lucide-react";

// ============== TYPES ==============

type RiskLevel = "low" | "some-concerns" | "high";

interface DomainAssessment {
    score: RiskLevel | null;
    justification: string;
    signallingQuestions?: Record<string, string | boolean>;
}

interface RoB2Assessment {
    domains: {
        randomization: DomainAssessment;
        deviations: DomainAssessment;
        missingData: DomainAssessment;
        measurement: DomainAssessment;
        selection: DomainAssessment;
    };
    overallRisk: RiskLevel | null;
    overallJustification: string;
}

interface RoB2AssessmentFormProps {
    projectWorkId: string;
    studyTitle: string;
    initialData?: Partial<RoB2Assessment>;
    onSave: (assessment: RoB2Assessment) => Promise<void>;
    className?: string;
}

// ============== DOMAIN DEFINITIONS ==============

const DOMAINS = [
    {
        key: "randomization" as const,
        label: "Domain 1: Randomization Process",
        description: "Risk of bias arising from the randomization process",
        questions: [
            "Was the allocation sequence random?",
            "Was the allocation sequence concealed until participants were enrolled and assigned to interventions?",
            "Did baseline differences between intervention groups suggest a problem with the randomization process?",
        ],
    },
    {
        key: "deviations" as const,
        label: "Domain 2: Deviations from Intended Interventions",
        description: "Risk of bias due to deviations from the intended interventions",
        questions: [
            "Were participants aware of their assigned intervention during the trial?",
            "Were carers and people delivering the interventions aware of participants' assigned intervention during the trial?",
            "Were there deviations from the intended intervention that arose because of the trial context?",
        ],
    },
    {
        key: "missingData" as const,
        label: "Domain 3: Missing Outcome Data",
        description: "Risk of bias due to missing outcome data",
        questions: [
            "Were data for this outcome available for all, or nearly all, participants randomized?",
            "Is there evidence that the result was not biased by missing outcome data?",
            "Could missingness in the outcome depend on its true value?",
        ],
    },
    {
        key: "measurement" as const,
        label: "Domain 4: Measurement of the Outcome",
        description: "Risk of bias in measurement of the outcome",
        questions: [
            "Was the method of measuring the outcome inappropriate?",
            "Could measurement or ascertainment of the outcome have differed between intervention groups?",
            "Were outcome assessors aware of the intervention received by study participants?",
        ],
    },
    {
        key: "selection" as const,
        label: "Domain 5: Selection of the Reported Result",
        description: "Risk of bias in selection of the reported result",
        questions: [
            "Were the data that produced this result analysed in accordance with a pre-specified analysis plan?",
            "Is the numerical result being assessed likely to have been selected, on the basis of the results, from multiple eligible analyses of the data?",
        ],
    },
];

// ============== MAIN COMPONENT ==============

export function RoB2AssessmentForm({
    projectWorkId,
    studyTitle,
    initialData,
    onSave,
    className,
}: RoB2AssessmentFormProps) {
    const [assessment, setAssessment] = useState<RoB2Assessment>(() => ({
        domains: {
            randomization: initialData?.domains?.randomization || { score: null, justification: "" },
            deviations: initialData?.domains?.deviations || { score: null, justification: "" },
            missingData: initialData?.domains?.missingData || { score: null, justification: "" },
            measurement: initialData?.domains?.measurement || { score: null, justification: "" },
            selection: initialData?.domains?.selection || { score: null, justification: "" },
        },
        overallRisk: initialData?.overallRisk || null,
        overallJustification: initialData?.overallJustification || "",
    }));

    const [expandedDomain, setExpandedDomain] = useState<string | null>("randomization");
    const [isSaving, setIsSaving] = useState(false);

    const updateDomainScore = useCallback((domain: keyof typeof assessment.domains, score: RiskLevel) => {
        setAssessment(prev => ({
            ...prev,
            domains: {
                ...prev.domains,
                [domain]: { ...prev.domains[domain], score },
            },
        }));
    }, []);

    const updateDomainJustification = useCallback((domain: keyof typeof assessment.domains, justification: string) => {
        setAssessment(prev => ({
            ...prev,
            domains: {
                ...prev.domains,
                [domain]: { ...prev.domains[domain], justification },
            },
        }));
    }, []);

    const calculateOverallRisk = useCallback((): RiskLevel => {
        const domainScores = Object.values(assessment.domains).map(d => d.score);
        if (domainScores.some(s => s === "high")) return "high";
        if (domainScores.some(s => s === "some-concerns")) return "some-concerns";
        if (domainScores.every(s => s === "low")) return "low";
        return "some-concerns"; // Default if incomplete
    }, [assessment.domains]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const finalAssessment = {
                ...assessment,
                overallRisk: assessment.overallRisk || calculateOverallRisk(),
            };
            await onSave(finalAssessment);
        } finally {
            setIsSaving(false);
        }
    };

    const isComplete = Object.values(assessment.domains).every(d => d.score !== null);

    return (
        <div className={cn("space-y-8", className)}>
            {/* Header */}
            <div className="border-b border-border pb-6">
                <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">RoB 2.0</Badge>
                    <span className="text-xs font-mono text-muted uppercase">Quality Assessment</span>
                </div>
                <h2 className="text-2xl font-serif">{studyTitle}</h2>
            </div>

            {/* Domain Assessments */}
            <div className="space-y-4">
                {DOMAINS.map((domain) => (
                    <DomainCard
                        key={domain.key}
                        domain={domain}
                        assessment={assessment.domains[domain.key]}
                        isExpanded={expandedDomain === domain.key}
                        onToggle={() => setExpandedDomain(
                            expandedDomain === domain.key ? null : domain.key
                        )}
                        onScoreChange={(score) => updateDomainScore(domain.key, score)}
                        onJustificationChange={(text) => updateDomainJustification(domain.key, text)}
                    />
                ))}
            </div>

            {/* Overall Assessment */}
            <div className="border border-border p-6 bg-paper">
                <h3 className="font-mono text-xs uppercase tracking-widest text-muted mb-4">
                    Overall Risk of Bias
                </h3>

                <div className="flex gap-3 mb-4">
                    <RiskButton
                        level="low"
                        selected={assessment.overallRisk === "low"}
                        onClick={() => setAssessment(prev => ({ ...prev, overallRisk: "low" }))}
                    />
                    <RiskButton
                        level="some-concerns"
                        selected={assessment.overallRisk === "some-concerns"}
                        onClick={() => setAssessment(prev => ({ ...prev, overallRisk: "some-concerns" }))}
                    />
                    <RiskButton
                        level="high"
                        selected={assessment.overallRisk === "high"}
                        onClick={() => setAssessment(prev => ({ ...prev, overallRisk: "high" }))}
                    />
                </div>

                <Textarea
                    value={assessment.overallJustification}
                    onChange={(e) => setAssessment(prev => ({
                        ...prev,
                        overallJustification: e.target.value
                    }))}
                    placeholder="Overall justification..."
                    className="min-h-[100px]"
                />
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
                <div className="text-sm text-muted">
                    {isComplete
                        ? <span className="text-green-600">All domains assessed</span>
                        : <span>{Object.values(assessment.domains).filter(d => d.score).length}/5 domains completed</span>
                    }
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? "Saving..." : "Save Assessment"}
                </Button>
            </div>
        </div>
    );
}

// ============== SUB-COMPONENTS ==============

interface DomainCardProps {
    domain: typeof DOMAINS[0];
    assessment: DomainAssessment;
    isExpanded: boolean;
    onToggle: () => void;
    onScoreChange: (score: RiskLevel) => void;
    onJustificationChange: (text: string) => void;
}

function DomainCard({
    domain,
    assessment,
    isExpanded,
    onToggle,
    onScoreChange,
    onJustificationChange,
}: DomainCardProps) {
    return (
        <div className="border border-border overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full p-4 flex items-center justify-between bg-white hover:bg-paper transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <RiskIndicator level={assessment.score} />
                    <div>
                        <h4 className="font-medium">{domain.label}</h4>
                        <p className="text-sm text-muted">{domain.description}</p>
                    </div>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-muted" />
                )}
            </button>

            {isExpanded && (
                <div className="p-6 border-t border-border space-y-6">
                    {/* Signalling Questions */}
                    <div className="space-y-3">
                        <p className="font-mono text-xs uppercase tracking-widest text-muted">
                            Signalling Questions
                        </p>
                        {domain.questions.map((question, i) => (
                            <div key={i} className="text-sm text-muted/80 pl-4 border-l-2 border-border">
                                {question}
                            </div>
                        ))}
                    </div>

                    {/* Risk Selection */}
                    <div className="flex gap-3">
                        <RiskButton
                            level="low"
                            selected={assessment.score === "low"}
                            onClick={() => onScoreChange("low")}
                        />
                        <RiskButton
                            level="some-concerns"
                            selected={assessment.score === "some-concerns"}
                            onClick={() => onScoreChange("some-concerns")}
                        />
                        <RiskButton
                            level="high"
                            selected={assessment.score === "high"}
                            onClick={() => onScoreChange("high")}
                        />
                    </div>

                    {/* Justification */}
                    <Textarea
                        value={assessment.justification}
                        onChange={(e) => onJustificationChange(e.target.value)}
                        placeholder="Justification for judgement..."
                        className="min-h-[100px]"
                    />
                </div>
            )}
        </div>
    );
}

function RiskIndicator({ level }: { level: RiskLevel | null }) {
    if (!level) {
        return <HelpCircle className="w-5 h-5 text-muted" />;
    }

    switch (level) {
        case "low":
            return <CheckCircle2 className="w-5 h-5 text-green-600" />;
        case "some-concerns":
            return <AlertCircle className="w-5 h-5 text-yellow-500" />;
        case "high":
            return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
}

function RiskButton({
    level,
    selected,
    onClick,
}: {
    level: RiskLevel;
    selected: boolean;
    onClick: () => void;
}) {
    const config = {
        low: { label: "Low Risk", color: "bg-green-600", textColor: "text-green-600" },
        "some-concerns": { label: "Some Concerns", color: "bg-yellow-500", textColor: "text-yellow-600" },
        high: { label: "High Risk", color: "bg-red-500", textColor: "text-red-600" },
    };

    const { label, color, textColor } = config[level];

    return (
        <button
            onClick={onClick}
            className={cn(
                "flex-1 px-4 py-2 border-2 rounded-sm transition-all font-medium text-sm",
                selected
                    ? `${color} text-white border-transparent`
                    : `bg-white ${textColor} border-current hover:opacity-80`
            )}
        >
            {label}
        </button>
    );
}

export default RoB2AssessmentForm;
