"use client";

import { Users, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function GlobalTeamPage() {
  return (
    <div className="space-y-12 pb-20">
      <header className="space-y-4">
        <h1 className="text-6xl font-serif">Collaboration</h1>
        <p className="text-muted font-serif italic text-xl">Select a project to manage its research collective.</p>
      </header>

      <div className="accent-line" />

      <div className="grid grid-cols-1 gap-6 max-w-3xl">
        <ProjectLinkCard id="1" title="Impact of LLMs on Clinical Practice" count={3} />
        <ProjectLinkCard id="2" title="Global Trends in Renewable Energy Policy" count={2} />
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

