"use client";

import { useProjects } from "@/features/projects/api/queries";
import { LineChart, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function GlobalAnalyticsPage() {
  const { data, isLoading, isError } = useProjects();
  const projects = data?.items || [];

  return (
    <div className="space-y-12 pb-20">
      <header className="space-y-4">
        <h1 className="text-6xl font-serif">Analytics</h1>
        <p className="text-muted font-serif italic text-xl">Select a project to view its evidence synthesis metrics.</p>
      </header>

      <div className="accent-line" />

      {isLoading && (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted" />
          <p className="mt-4 text-muted font-serif italic">Aggregating evidence metrics...</p>
        </div>
      )}

      {isError && (
        <div className="py-20 text-center text-rose-500">
          <AlertCircle className="w-8 h-8 mx-auto" />
          <p className="mt-4 font-serif">Failed to load analytics data.</p>
        </div>
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <div className="py-20 text-center text-muted">
          <p className="font-serif italic text-xl">No active projects found.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 max-w-3xl">
        {projects.map((project: any) => (
          <ProjectLinkCard
            key={project.id}
            id={project.id}
            title={project.title}
            progress={project.progress}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectLinkCard({ id, title, progress }: { id: string, title: string, progress: number }) {
  return (
    <Link href={`/project/${id}/analytics`} className="group bg-white border border-border p-8 hover:border-ink transition-all flex justify-between items-center">
      <div className="flex items-center gap-6">
        <div className="w-12 h-12 bg-paper border border-border flex items-center justify-center">
          <LineChart className="w-6 h-6 text-muted group-hover:text-ink transition-colors" />
        </div>
        <div className="space-y-1">
          <h3 className="text-2xl font-serif group-hover:underline">{title}</h3>
          <span className="font-mono text-[10px] uppercase text-muted tracking-widest">{progress}% Complete</span>
        </div>
      </div>
      <ArrowRight className="w-6 h-6 text-muted group-hover:text-ink transition-all translate-x-0 group-hover:translate-x-2" />
    </Link>
  );
}

