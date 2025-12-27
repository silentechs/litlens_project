import { db } from "@/lib/db";
import {
    Users,
    FolderOpen,
    FileText,
    Activity,
    TrendingUp,
    Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

async function getAdminStats() {
    const [
        userCount,
        projectCount,
        activeProjects,
        screenedCount,
        recentActivities,
    ] = await Promise.all([
        db.user.count(),
        db.project.count(),
        db.project.count({ where: { status: "ACTIVE" } }),
        db.projectWork.count({
            where: {
                status: { in: ["INCLUDED", "EXCLUDED"] }
            }
        }),
        db.activity.findMany({
            take: 10,
            orderBy: { createdAt: "desc" },
            include: { user: true },
        }),
    ]);

    return {
        userCount,
        projectCount,
        activeProjects,
        screenedCount,
        recentActivities,
    };
}



export default async function AdminOverviewPage() {
    const stats = await getAdminStats();

    return (
        <div className="space-y-12">
            <header>
                <h1 className="text-5xl font-serif">Admin Dashboard</h1>
                <p className="text-muted font-serif italic text-lg mt-2">
                    Platform overview and management
                </p>
            </header>

            <div className="accent-line" />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Users"
                    value={stats.userCount}
                    icon={<Users className="w-5 h-5" />}
                    trend="+12% this month"
                />
                <StatCard
                    title="Total Projects"
                    value={stats.projectCount}
                    icon={<FolderOpen className="w-5 h-5" />}
                />
                <StatCard
                    title="Active Projects"
                    value={stats.activeProjects}
                    icon={<Activity className="w-5 h-5" />}
                />
                <StatCard
                    title="Studies Screened"
                    value={stats.screenedCount}
                    icon={<FileText className="w-5 h-5" />}
                />
            </div>

            {/* Quick Actions & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <QuickAction
                            href="/admin/users"
                            title="Manage Users"
                            description="View and manage platform users"
                        />
                        <QuickAction
                            href="/admin/analytics"
                            title="View Analytics"
                            description="Platform usage and performance metrics"
                        />
                        <QuickAction
                            href="/admin/settings"
                            title="System Settings"
                            description="Configure platform settings"
                        />
                    </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats.recentActivities.length > 0 ? (
                                stats.recentActivities.map((activity) => (
                                    <div key={activity.id} className="flex items-start gap-3">
                                        <Clock className="w-4 h-4 text-muted mt-0.5" />
                                        <div>
                                            <p className="text-sm">
                                                <span className="font-medium">{activity.user?.name || "Unknown"}</span>{" "}
                                                {activity.description}
                                            </p>
                                            <p className="text-xs text-muted">
                                                {new Date(activity.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted font-serif italic">No recent activity</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({
    title,
    value,
    icon,
    trend,
    description,
}: {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    trend?: string;
    description?: string;
}) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-mono uppercase tracking-widest text-muted">{title}</p>
                        <p className="text-4xl font-serif">{value}</p>
                        {trend && (
                            <p className="text-xs text-intel-blue flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                {trend}
                            </p>
                        )}
                        {description && (
                            <p className="text-xs text-muted italic">{description}</p>
                        )}
                    </div>
                    <div className="p-2 bg-ink/5 rounded-sm">
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function QuickAction({
    href,
    title,
    description,
}: {
    href: string;
    title: string;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="block p-4 border border-border hover:border-ink hover:shadow-editorial transition-all group"
        >
            <h4 className="font-serif italic text-lg group-hover:underline">{title}</h4>
            <p className="text-sm text-muted">{description}</p>
        </Link>
    );
}
