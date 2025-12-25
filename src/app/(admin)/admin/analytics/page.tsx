import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart3,
    TrendingUp,
    Users,
    FolderOpen,
    Clock,
} from "lucide-react";

async function getAnalytics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
        totalUsers,
        newUsersThisMonth,
        totalProjects,
        activeProjects,
        recentActivities,
    ] = await Promise.all([
        db.user.count(),
        db.user.count({
            where: { createdAt: { gte: thirtyDaysAgo } },
        }),
        db.project.count(),
        db.project.count({ where: { status: "ACTIVE" } }),
        db.activity.count({
            where: { createdAt: { gte: thirtyDaysAgo } },
        }),
    ]);

    return {
        totalUsers,
        newUsersThisMonth,
        totalProjects,
        activeProjects,
        recentActivities,
    };
}

export default async function AnalyticsPage() {
    const analytics = await getAnalytics();

    return (
        <div className="space-y-12">
            <header>
                <h1 className="text-5xl font-serif">Analytics</h1>
                <p className="text-muted font-serif italic text-lg mt-2">
                    Platform usage and performance metrics
                </p>
            </header>

            <div className="accent-line" />

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-ink text-paper rounded-sm">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-mono uppercase tracking-widest text-muted">User Growth</p>
                                <p className="text-3xl font-serif">{analytics.newUsersThisMonth}</p>
                                <p className="text-xs text-intel-blue flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    new this month
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-ink text-paper rounded-sm">
                                <FolderOpen className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-mono uppercase tracking-widest text-muted">Projects</p>
                                <p className="text-3xl font-serif">{analytics.activeProjects}/{analytics.totalProjects}</p>
                                <p className="text-xs text-muted">active / total</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-ink text-paper rounded-sm">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-mono uppercase tracking-widest text-muted">Activity</p>
                                <p className="text-3xl font-serif">{analytics.recentActivities}</p>
                                <p className="text-xs text-muted">actions in 30 days</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Placeholder */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Usage Trends
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 flex items-center justify-center border border-dashed border-border rounded-sm">
                        <p className="text-muted font-serif italic">
                            Charts coming in Phase 3 — Advanced Analytics
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Platform Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-paper border border-border">
                            <p className="text-sm font-mono uppercase tracking-widest text-muted">Total Users</p>
                            <p className="text-2xl font-serif mt-1">{analytics.totalUsers}</p>
                        </div>
                        <div className="p-4 bg-paper border border-border">
                            <p className="text-sm font-mono uppercase tracking-widest text-muted">New Users (30d)</p>
                            <p className="text-2xl font-serif mt-1">{analytics.newUsersThisMonth}</p>
                        </div>
                        <div className="p-4 bg-paper border border-border">
                            <p className="text-sm font-mono uppercase tracking-widest text-muted">Total Projects</p>
                            <p className="text-2xl font-serif mt-1">{analytics.totalProjects}</p>
                        </div>
                        <div className="p-4 bg-paper border border-border">
                            <p className="text-sm font-mono uppercase tracking-widest text-muted">Active Projects</p>
                            <p className="text-2xl font-serif mt-1">{analytics.activeProjects}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
