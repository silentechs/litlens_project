"use client";

import { useProjects } from "@/features/projects/api/queries";
import { Users, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function GlobalTeamPage() {
  const { data, isLoading, isError } = useProjects();
  const projects = data?.items || [];

  return (
    <div className="space-y-12 pb-20">
      <header className="space-y-4">
        <h1 className="text-6xl font-serif">Collaboration</h1>
        <p className="text-muted font-serif italic text-xl">Select a project to manage its research collective.</p>
      </header>

      <div className="accent-line" />

      {isLoading && (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted" />
          <p className="mt-4 text-muted font-serif italic">Identifying research collectives...</p>
        </div>
      )}

      {isError && (
        <div className="py-20 text-center text-rose-500">
          <AlertCircle className="w-8 h-8 mx-auto" />
          <p className="mt-4 font-serif">Failed to load project teams.</p>
        </div>
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <div className="py-20 text-center text-muted">
          <p className="font-serif italic text-xl">No active projects found.</p>
          <p className="text-sm">Create a project to start collaborating.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 max-w-3xl">
        {projects.map((project: any) => (
          <ProjectLinkCard
            key={project.id}
            id={project.id}
            title={project.title}
            count={project._count.members}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectLinkCard({ id, title, count }: { id: string, title: string, count: number }) {
  return (
    <Link href={`/project/${id}/team`} className="group bg-white border border-border p-8 hover:border-ink transition-all flex justify-between items-center">
      <div className="flex items-center gap-6">
        <div className="w-12 h-12 bg-paper border border-border flex items-center justify-center">
          <Users className="w-6 h-6 text-muted group-hover:text-ink transition-colors" />
        </div>
        <div className="space-y-1">
          <h3 className="text-2xl font-serif group-hover:underline">{title}</h3>
          <span className="font-mono text-[10px] uppercase text-muted tracking-widest">{count} Members</span>
        </div>
      </div>
      <ArrowRight className="w-6 h-6 text-muted group-hover:text-ink transition-all translate-x-0 group-hover:translate-x-2" />
    </Link>
  );
}

