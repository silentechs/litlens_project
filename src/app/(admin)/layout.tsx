import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import {
    Users,
    BarChart3,
    Settings,
    Activity,
    ChevronRight,
    Shield,
} from "lucide-react";

async function requireAdmin() {
    const session = await auth();

    if (!session?.user) {
        redirect("/auth/signin");
    }

    // Check admin role
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    return session;
}

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await requireAdmin();

    return (
        <div className="min-h-screen bg-paper">
            <div className="flex">
                {/* Sidebar */}
                <aside className="w-64 min-h-screen bg-ink text-paper border-r border-white/10 p-6">
                    <div className="mb-12">
                        <Link href="/admin" className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-intel-blue" />
                            <span className="font-serif italic text-xl">Admin</span>
                        </Link>
                    </div>

                    <nav className="space-y-2">
                        <NavItem href="/admin" icon={<BarChart3 className="w-4 h-4" />}>
                            Overview
                        </NavItem>
                        <NavItem href="/admin/users" icon={<Users className="w-4 h-4" />}>
                            Users
                        </NavItem>
                        <NavItem href="/admin/analytics" icon={<Activity className="w-4 h-4" />}>
                            Analytics
                        </NavItem>
                        <NavItem href="/admin/settings" icon={<Settings className="w-4 h-4" />}>
                            Settings
                        </NavItem>
                    </nav>

                    <div className="mt-auto pt-12">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-2 text-sm text-paper/60 hover:text-paper transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 rotate-180" />
                            Back to Dashboard
                        </Link>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-12">
                    <div className="max-w-6xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

function NavItem({
    href,
    icon,
    children
}: {
    href: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            className="flex items-center gap-3 px-3 py-2 text-sm text-paper/80 hover:text-paper hover:bg-white/5 rounded-sm transition-colors"
        >
            {icon}
            {children}
        </Link>
    );
}
