import { Dashboard } from "@/features/analytics/components/Dashboard";

export default async function ProjectOverviewPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <Dashboard projectId={id} title="Project Overview" />;
}
