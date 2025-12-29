"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    BarChart3,
    TrendingUp,
    Users,
    AlertTriangle,
    Download,
    Loader2,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Activity,
    Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface DashboardProps {
    projectId: string;
    title?: string;
}

export function Dashboard({ projectId, title = "Screening Analytics" }: DashboardProps) {
    const [selectedPhase, setSelectedPhase] = useState<string>("TITLE_ABSTRACT");

    // Fetch analytics data
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["screening-analytics", projectId, selectedPhase],
        queryFn: async () => {
            const response = await fetch(
                `/api/projects/${projectId}/screening/analytics?phase=${selectedPhase}&include=kappa,agreement,conflicts,performance,velocity,stats`,
                { credentials: "include" }
            );

            if (!response.ok) {
                throw new Error("Failed to fetch analytics");
            }

            const result = await response.json();
            return result.data;
        },
    });

    const handleExport = async () => {
        const response = await fetch(
            `/api/projects/${projectId}/screening/analytics/export`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format: "csv" }),
                credentials: "include",
            }
        );

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `screening-analytics-${projectId}.csv`;
            a.click();
        }
    };

    if (isLoading) {
        return (
            <div className="py-40 text-center space-y-8">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-muted" />
                <p className="text-muted font-serif italic text-xl">
                    Calculating analytics...
                </p>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="py-40 text-center space-y-8">
                <AlertTriangle className="w-12 h-12 mx-auto text-rose-500" />
                <p className="text-ink font-serif text-xl">Failed to load analytics</p>
                <Button onClick={() => refetch()} variant="outline">
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <header className="flex justify-between items-end">
                <div className="space-y-4">
                    <h1 className="text-6xl font-serif">{title}</h1>
                    <p className="text-muted font-serif italic text-xl">
                        Inter-rater reliability, performance metrics, and quality assurance.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                        <SelectTrigger className="w-[200px] font-mono text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="TITLE_ABSTRACT">Title & Abstract</SelectItem>
                            <SelectItem value="FULL_TEXT">Full Text</SelectItem>
                            <SelectItem value="all">All Phases</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        onClick={handleExport}
                        variant="outline"
                        className="font-mono text-xs uppercase tracking-widest"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </header>

            <div className="accent-line" />

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Kappa Score */}
                {data.kappa && (
                    <MetricCard
                        icon={<Award className="w-5 h-5" />}
                        label="Cohen's Kappa"
                        value={data.kappa.score !== null ? data.kappa.score.toFixed(3) : "N/A"}
                        subtitle={data.kappa.interpretation}
                        color={data.kappa.color}
                        description={`${data.kappa.studiesAnalyzed} studies analyzed`}
                    />
                )}

                {/* Agreement Rate */}
                {data.agreement && (
                    <MetricCard
                        icon={<CheckCircle2 className="w-5 h-5" />}
                        label="Agreement Rate"
                        value={
                            data.agreement.agreementRate !== null
                                ? `${data.agreement.agreementRate}%`
                                : "N/A"
                        }
                        subtitle={`${data.agreement.agreements} / ${data.agreement.total}`}
                        color={
                            data.agreement.agreementRate >= 80
                                ? "#10B981"
                                : data.agreement.agreementRate >= 60
                                    ? "#F59E0B"
                                    : "#EF4444"
                        }
                        description="Reviewers agreed"
                    />
                )}

                {/* Conflicts */}
                {data.conflicts && (
                    <MetricCard
                        icon={<AlertTriangle className="w-5 h-5" />}
                        label="Conflicts"
                        value={data.conflicts.total.toString()}
                        subtitle={`${data.conflicts.resolved} resolved`}
                        color={
                            data.conflicts.pending === 0
                                ? "#10B981"
                                : data.conflicts.pending < 5
                                    ? "#F59E0B"
                                    : "#EF4444"
                        }
                        description={`${data.conflicts.resolutionRate}% resolved`}
                    />
                )}

                {/* Total Studies */}
                {data.stats && (
                    <MetricCard
                        icon={<Activity className="w-5 h-5" />}
                        label="Studies Screened"
                        value={data.stats.total.toString()}
                        subtitle={`${data.stats.pending} pending`}
                        color="#3B82F6"
                        description={`${data.stats.included} included, ${data.stats.excluded} excluded`}
                    />
                )}
            </div>

            {/* Kappa Interpretation */}
            {data.kappa && data.kappa.score !== null && (
                <div
                    className="p-6 border-l-4 rounded-sm"
                    style={{
                        borderColor: data.kappa.color,
                        backgroundColor: `${data.kappa.color}10`,
                    }}
                >
                    <div className="flex items-start gap-4">
                        <Award
                            className="w-6 h-6 flex-shrink-0 mt-1"
                            style={{ color: data.kappa.color }}
                        />
                        <div className="space-y-2">
                            <h3
                                className="font-mono text-sm uppercase tracking-widest font-bold"
                                style={{ color: data.kappa.color }}
                            >
                                {data.kappa.interpretation} Agreement
                            </h3>
                            <p className="font-serif italic text-muted leading-relaxed">
                                {data.kappa.recommendation}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Reviewer Performance */}
            {data.performance && data.performance.length > 0 && (
                <section className="space-y-6">
                    <h2 className="text-2xl font-serif font-bold flex items-center gap-3">
                        <Users className="w-6 h-6" />
                        Reviewer Performance
                    </h2>

                    <div className="bg-white border border-border rounded-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-paper border-b border-border">
                                <tr>
                                    <th className="px-6 py-4 text-left font-mono text-[10px] uppercase tracking-widest text-muted">
                                        Reviewer
                                    </th>
                                    <th className="px-6 py-4 text-right font-mono text-[10px] uppercase tracking-widest text-muted">
                                        Studies
                                    </th>
                                    <th className="px-6 py-4 text-right font-mono text-[10px] uppercase tracking-widest text-muted">
                                        Avg Time
                                    </th>
                                    <th className="px-6 py-4 text-right font-mono text-[10px] uppercase tracking-widest text-muted">
                                        Confidence
                                    </th>
                                    <th className="px-6 py-4 text-right font-mono text-[10px] uppercase tracking-widest text-muted">
                                        Consensus
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {data.performance.map((reviewer: any) => (
                                    <tr key={reviewer.reviewerId} className="hover:bg-paper/50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-intel-blue/10 border border-intel-blue/30 flex items-center justify-center font-bold text-[10px] text-intel-blue">
                                                    {reviewer.name
                                                        .split(" ")
                                                        .map((n: string) => n[0])
                                                        .join("")}
                                                </div>
                                                <span className="font-serif italic">{reviewer.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-sm">
                                            {reviewer.studiesReviewed}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-sm">
                                            {reviewer.avgTimePerStudy}s
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-sm">
                                            {reviewer.avgConfidence}%
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {reviewer.agreementWithConsensus !== null ? (
                                                <span
                                                    className={cn(
                                                        "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest",
                                                        reviewer.agreementWithConsensus >= 80
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : reviewer.agreementWithConsensus >= 60
                                                                ? "bg-amber-50 text-amber-700"
                                                                : "bg-rose-50 text-rose-700"
                                                    )}
                                                >
                                                    {reviewer.agreementWithConsensus}%
                                                </span>
                                            ) : (
                                                <span className="text-muted text-sm">N/A</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Screening Velocity Chart */}
            {data.velocity && data.velocity.length > 0 && (
                <section className="space-y-6">
                    <h2 className="text-2xl font-serif font-bold flex items-center gap-3">
                        <TrendingUp className="w-6 h-6" />
                        Screening Velocity
                    </h2>

                    <div className="bg-white border border-border rounded-sm p-6">
                        <div className="space-y-3">
                            {data.velocity.slice(-14).map((day: any, index: number) => (
                                <div key={day.date} className="flex items-center gap-4">
                                    <div className="w-24 font-mono text-xs text-muted">
                                        {new Date(day.date).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </div>
                                    <div className="flex-1 h-8 bg-paper rounded-sm overflow-hidden relative">
                                        <div
                                            className="h-full bg-intel-blue transition-all duration-500"
                                            style={{
                                                width: `${Math.min((day.studiesScreened / Math.max(...data.velocity.map((d: any) => d.studiesScreened))) * 100, 100)}%`,
                                            }}
                                        />
                                        <div className="absolute inset-0 flex items-center px-3 font-mono text-xs text-ink">
                                            {day.studiesScreened} studies • {day.avgTimePerStudy}s avg
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Decision Distribution */}
            {data.stats && (
                <section className="space-y-6">
                    <h2 className="text-2xl font-serif font-bold flex items-center gap-3">
                        <BarChart3 className="w-6 h-6" />
                        Decision Distribution
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <DecisionCard
                            icon={<CheckCircle2 className="w-8 h-8" />}
                            label="Included"
                            count={data.stats.included}
                            total={data.stats.total}
                            color="emerald"
                        />
                        <DecisionCard
                            icon={<XCircle className="w-8 h-8" />}
                            label="Excluded"
                            count={data.stats.excluded}
                            total={data.stats.total}
                            color="rose"
                        />
                        <DecisionCard
                            icon={<HelpCircle className="w-8 h-8" />}
                            label="Maybe"
                            count={data.stats.maybe}
                            total={data.stats.total}
                            color="amber"
                        />
                    </div>
                </section>
            )}
        </div>
    );
}

interface MetricCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    subtitle: string;
    color: string;
    description: string;
}

function MetricCard({
    icon,
    label,
    value,
    subtitle,
    color,
    description,
}: MetricCardProps) {
    return (
        <div className="bg-white border border-border rounded-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div style={{ color }}>{icon}</div>
                <span
                    className="px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest font-bold"
                    style={{
                        backgroundColor: `${color}15`,
                        color,
                        borderColor: `${color}30`,
                        borderWidth: "1px",
                    }}
                >
                    {subtitle}
                </span>
            </div>

            <div className="space-y-2">
                <div className="text-4xl font-serif font-bold" style={{ color }}>
                    {value}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    {label}
                </div>
                <div className="text-xs font-serif italic text-muted">{description}</div>
            </div>
        </div>
    );
}

interface DecisionCardProps {
    icon: React.ReactNode;
    label: string;
    count: number;
    total: number;
    color: "emerald" | "rose" | "amber";
}

function DecisionCard({ icon, label, count, total, color }: DecisionCardProps) {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

    const colorMap = {
        emerald: {
            bg: "bg-emerald-50",
            text: "text-emerald-700",
            border: "border-emerald-200",
            bar: "bg-emerald-500",
        },
        rose: {
            bg: "bg-rose-50",
            text: "text-rose-700",
            border: "border-rose-200",
            bar: "bg-rose-500",
        },
        amber: {
            bg: "bg-amber-50",
            text: "text-amber-700",
            border: "border-amber-200",
            bar: "bg-amber-500",
        },
    };

    const colors = colorMap[color];

    return (
        <div className={cn("border rounded-sm p-6 space-y-4", colors.bg, colors.border)}>
            <div className={cn("flex items-center gap-3", colors.text)}>
                {icon}
                <h3 className="font-serif italic text-xl">{label}</h3>
            </div>

            <div className="space-y-3">
                <div className={cn("text-5xl font-serif font-bold", colors.text)}>
                    {count}
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                            {percentage}% of total
                        </span>
                    </div>
                    <div className="h-2 bg-white rounded-full overflow-hidden">
                        <div
                            className={cn("h-full transition-all duration-500", colors.bar)}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
