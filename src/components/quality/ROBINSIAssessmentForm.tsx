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
    AlertTriangle,
} from "lucide-react";

// ============== TYPES ==============

type RiskLevel = "low" | "moderate" | "serious" | "critical" | "no-information";

interface DomainAssessment {
    score: RiskLevel | null;
    justification: string;
}

interface ROBINSIAssessment {
    domains: {
        confounding: DomainAssessment;
        selection: DomainAssessment;
        classification: DomainAssessment;
        deviations: DomainAssessment;
        missingData: DomainAssessment;
        measurement: DomainAssessment;
        reportedResult: DomainAssessment;
    };
    overallRisk: RiskLevel | null;
    overallJustification: string;
}

interface ROBINSIAssessmentFormProps {
    projectWorkId: string;
    studyTitle: string;
    initialData?: Partial<ROBINSIAssessment>;
    onSave: (assessment: ROBINSIAssessment) => Promise<void>;
    className?: string;
}

// ============== DOMAIN DEFINITIONS ==============

const DOMAINS = [
    {
        key: "confounding" as const,
        label: "Domain 1: Bias due to confounding",
        description: "Confounding occurs when common causes of the intervention and outcome are not controlled",
    },
    {
        key: "selection" as const,
        label: "Domain 2: Bias in selection of participants",
        description: "Selection bias occurs when selection into the study is related to both intervention and outcome",
    },
    {
        key: "classification" as const,
        label: "Domain 3: Bias in classification of interventions",
        description: "Bias due to differential or non-differential classification of intervention status",
    },
    {
        key: "deviations" as const,
        label: "Domain 4: Bias due to deviations from intended interventions",
        description: "Bias arising when there are systematic differences in care provided",
    },
    {
        key: "missingData" as const,
        label: "Domain 5: Bias due to missing data",
        description: "Bias due to missing data for participants, outcomes, or other variables",
    },
    {
        key: "measurement" as const,
        label: "Domain 6: Bias in measurement of outcomes",
        description: "Bias due to errors in measurement of the outcome",
    },
    {
        key: "reportedResult" as const,
        label: "Domain 7: Bias in selection of the reported result",
        description: "Selective reporting of results based on findings",
    },
];

// ============== MAIN COMPONENT ==============

export function ROBINSIAssessmentForm({
    projectWorkId,
    studyTitle,
    initialData,
    onSave,
    className,
}: ROBINSIAssessmentFormProps) {
    const [assessment, setAssessment] = useState<ROBINSIAssessment>(() => ({
        domains: {
            confounding: initialData?.domains?.confounding || { score: null, justification: "" },
            selection: initialData?.domains?.selection || { score: null, justification: "" },
            classification: initialData?.domains?.classification || { score: null, justification: "" },
            deviations: initialData?.domains?.deviations || { score: null, justification: "" },
            missingData: initialData?.domains?.missingData || { score: null, justification: "" },
            measurement: initialData?.domains?.measurement || { score: null, justification: "" },
            reportedResult: initialData?.domains?.reportedResult || { score: null, justification: "" },
        },
        overallRisk: initialData?.overallRisk || null,
        overallJustification: initialData?.overallJustification || "",
    }));

    const [expandedDomain, setExpandedDomain] = useState<string | null>("confounding");
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

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(assessment);
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
                    <Badge variant="outline">ROBINS-I</Badge>
                    <span className="text-xs font-mono text-muted uppercase">Non-Randomized Studies</span>
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

                <div className="flex flex-wrap gap-2 mb-4">
                    {(["low", "moderate", "serious", "critical", "no-information"] as RiskLevel[]).map((level) => (
                        <RiskButton
                            key={level}
                            level={level}
                            selected={assessment.overallRisk === level}
                            onClick={() => setAssessment(prev => ({ ...prev, overallRisk: level }))}
                        />
                    ))}
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
                        : <span>{Object.values(assessment.domains).filter(d => d.score).length}/7 domains completed</span>
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
                    {/* Risk Selection */}
                    <div className="flex flex-wrap gap-2">
                        {(["low", "moderate", "serious", "critical", "no-information"] as RiskLevel[]).map((level) => (
                            <RiskButton
                                key={level}
                                level={level}
                                selected={assessment.score === level}
                                onClick={() => onScoreChange(level)}
                            />
                        ))}
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
        case "moderate":
            return <AlertCircle className="w-5 h-5 text-yellow-500" />;
        case "serious":
            return <AlertTriangle className="w-5 h-5 text-orange-500" />;
        case "critical":
            return <AlertCircle className="w-5 h-5 text-red-600" />;
        case "no-information":
            return <HelpCircle className="w-5 h-5 text-gray-400" />;
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
    const config: Record<RiskLevel, { label: string; color: string; textColor: string }> = {
        low: { label: "Low", color: "bg-green-600", textColor: "text-green-600" },
        moderate: { label: "Moderate", color: "bg-yellow-500", textColor: "text-yellow-600" },
        serious: { label: "Serious", color: "bg-orange-500", textColor: "text-orange-600" },
        critical: { label: "Critical", color: "bg-red-600", textColor: "text-red-600" },
        "no-information": { label: "No Info", color: "bg-gray-400", textColor: "text-gray-500" },
    };

    const { label, color, textColor } = config[level];

    return (
        <button
            onClick={onClick}
            className={cn(
                "px-4 py-2 border-2 rounded-sm transition-all font-medium text-sm",
                selected
                    ? `${color} text-white border-transparent`
                    : `bg-white ${textColor} border-current hover:opacity-80`
            )}
        >
            {label}
        </button>
    );
}

export default ROBINSIAssessmentForm;
