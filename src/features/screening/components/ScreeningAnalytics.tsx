"use client";

import { useScreeningAnalytics } from "@/features/screening/api/queries";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area
} from "recharts";
import {
    CheckCircle2,
    XCircle,
    AlertCircle,
    Clock,
    Users,
    ShieldAlert,
    TrendingUp,
    Info
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { PrismaFlow } from "@/features/analytics/components/PrismaFlow";

interface ScreeningAnalyticsProps {
    projectId: string;
}

export function ScreeningAnalytics({ projectId }: ScreeningAnalyticsProps) {
    const { data, isLoading } = useScreeningAnalytics(projectId);

    const [activeTab, setActiveTab] = useState<'overview' | 'prisma'>('overview');

    if (isLoading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-muted" />
                <p className="font-serif italic text-muted">Analyzing screening trajectory...</p>
            </div>
        );
    }

    if (!data) return null;

    // Destructure with safe defaults to prevent undefined access
    const overview = data.overview || { overall: { percentComplete: 0, totalDecisions: 0 }, byPhase: {} };
    const reviewers = data.reviewers || [];
    const timeline = data.timeline || [];
    const conflicts = data.conflicts || { total: 0, pending: 0, resolved: 0 };
    const interRaterReliability = data.interRaterReliability || { kappa: null };

    // Ensure overview.overall exists
    const overallStats = overview.overall || { percentComplete: 0, totalDecisions: 0 };

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="space-y-8">
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={cn(
                        "px-6 py-3 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors",
                        activeTab === 'overview'
                            ? "border-ink text-ink font-bold"
                            : "border-transparent text-muted hover:text-ink"
                    )}
                >
                    Overview
                </button>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="space-y-12 pb-20"
            >
                {/* Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <motion.div variants={item} className="p-6 bg-white border border-border shadow-sm rounded-sm">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Completion</span>
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="text-4xl font-serif mt-2">{overallStats.percentComplete.toFixed(1)}%</div>
                        <div className="mt-2 h-1 bg-paper w-full rounded-full overflow-hidden">
                            <div
                                className="h-full bg-ink transition-all duration-1000"
                                style={{ width: `${overallStats.percentComplete}%` }}
                            />
                        </div>
                    </motion.div>

                    <motion.div variants={item} className="p-6 bg-white border border-border shadow-sm rounded-sm">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Conflicts</span>
                            <ShieldAlert className={cn("w-4 h-4", conflicts.pending > 0 ? "text-amber-500" : "text-emerald-500")} />
                        </div>
                        <div className="text-4xl font-serif mt-2">{conflicts.total}</div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted mt-2">
                            {conflicts.resolved} Resolved / {conflicts.pending} Pending
                        </div>
                    </motion.div>

                    <motion.div variants={item} className="p-6 bg-white border border-border shadow-sm rounded-sm">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Reliability (IRR)</span>
                            <Users className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="text-4xl font-serif mt-2">
                            {interRaterReliability?.kappa?.toFixed(2) || "0.00"}
                        </div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted mt-2">
                            Cohens Kappa (Current Phase)
                        </div>
                    </motion.div>

                    <motion.div variants={item} className="p-6 bg-white border border-border shadow-sm rounded-sm">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Decisions</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="text-4xl font-serif mt-2">{overallStats.totalDecisions}</div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted mt-2">
                            Total judgments across team
                        </div>
                    </motion.div>
                </div>

                {/* Timeline Chart */}
                <motion.div variants={item} className="p-8 bg-white border border-border shadow-sm rounded-sm space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-serif">Screening Velocity</h3>
                        <div className="flex gap-4 text-[10px] font-mono uppercase tracking-widest text-muted">
                            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-ink rounded-full" /> Cumulative</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full" /> Daily Included</div>
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timeline}>
                                <defs>
                                    <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#1a1a1a" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#1a1a1a" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="date"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                />
                                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '0px', border: '1px solid #e5e5e5', backgroundColor: '#fff', fontSize: '12px', fontFamily: 'serif' }}
                                />
                                <Area type="monotone" dataKey="cumulative" stroke="#1a1a1a" fillOpacity={1} fill="url(#colorCum)" strokeWidth={2} />
                                <Bar dataKey="included" fill="#10b981" barSize={12} radius={[2, 2, 0, 0]} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Team Performance */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <motion.div variants={item} className="space-y-6">
                        <h3 className="text-xl font-serif">Reviewer Consensus</h3>
                        <div className="bg-white border border-border rounded-sm overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-paper border-b border-border">
                                    <tr className="text-[10px] font-mono uppercase tracking-widest text-muted">
                                        <th className="px-6 py-4">Reviewer</th>
                                        <th className="px-6 py-4">Decisions</th>
                                        <th className="px-6 py-4">Agreement</th>
                                        <th className="px-6 py-4">Avg Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {reviewers.map((r: any) => (
                                        <tr key={r.userId} className="hover:bg-paper/50 transition-colors">
                                            <td className="px-6 py-4 flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-paper flex items-center justify-center text-[8px] font-bold border border-border">
                                                    {r.userName?.substring(0, 2).toUpperCase() || "US"}
                                                </div>
                                                <span className="text-sm font-serif italic">{r.userName || "Unknown"}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono">{r.decisionsCount}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-paper rounded-full overflow-hidden">
                                                        <div className="h-full bg-intel-blue" style={{ width: `${r.agreementRate}%` }} />
                                                    </div>
                                                    <span className="text-xs font-mono">{r.agreementRate.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono text-muted">
                                                {r.avgTimePerDecision > 0 ? (r.avgTimePerDecision / 1000).toFixed(1) : "N/A"} s
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>

                    <motion.div variants={item} className="space-y-6">
                        <h3 className="text-xl font-serif">Conflict Breakdown</h3>
                        <div className="p-8 bg-white border border-border shadow-sm rounded-sm flex items-center justify-center h-[340px]">
                            <div className="text-center space-y-4">
                                <div className="text-6xl font-serif text-ink">{conflicts.total}</div>
                                <p className="text-muted font-serif italic max-w-xs mx-auto">
                                    Total Divergent Assessments identified during systematic review.
                                </p>
                                <div className="flex justify-center gap-4 pt-4">
                                    <div className="text-center">
                                        <div className="text-xs font-mono uppercase tracking-widest text-emerald-600">{conflicts.resolved}</div>
                                        <div className="text-[9px] font-mono text-muted uppercase">Resolved</div>
                                    </div>
                                    <div className="w-[1px] h-8 bg-border" />
                                    <div className="text-center">
                                        <div className="text-xs font-mono uppercase tracking-widest text-amber-600">{conflicts.pending}</div>
                                        <div className="text-[9px] font-mono text-muted uppercase">Pending</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
}
