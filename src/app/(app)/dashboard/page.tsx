"use client";

import { useAppStore } from "@/stores/app-store";
import { useProjects } from "@/features/projects/api/queries";
import { UnifiedSearch } from "@/features/discovery/components/UnifiedSearch";
import { 
  Plus, 
  ArrowUpRight, 
  Clock, 
  Sparkles,
  Loader2,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { ProjectListItem } from "@/types/project";

export default function DashboardPage() {
  const { mode } = useAppStore();
  const { data, isLoading, isError } = useProjects({ limit: 5 });

  if (mode === 'INTELLIGENCE') {
    return <UnifiedSearch />;
  }

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-2">
          <h1 className="text-6xl font-serif">Review Operations</h1>
          <p className="text-muted font-serif italic text-xl">Systematic evidence synthesis platform.</p>
        </div>
        <Link href="/projects/new">
          <button className="btn-editorial flex items-center gap-2">
            <Plus className="w-5 h-5" />
            New Project
          </button>
        </Link>
      </header>

      <div className="accent-line" />

      {/* Project Stats Grid */}
      <div className="editorial-grid">
        <div className="col-span-12 md:col-span-8 space-y-8">
          <h2 className="text-2xl font-mono uppercase tracking-widest text-muted">Active Projects</h2>
          
          {/* Loading */}
          {isLoading && (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted" />
              <p className="mt-4 text-muted font-serif italic text-sm">Loading projects...</p>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !isError && data?.items.length === 0 && (
            <div className="py-12 text-center bg-white border border-border rounded-sm">
              <FolderOpen className="w-12 h-12 mx-auto text-muted/50" />
              <p className="mt-4 text-muted font-serif italic">No active projects. Create one to get started.</p>
              <Link href="/projects/new" className="mt-4 inline-block">
                <button className="btn-editorial text-sm">
                  <Plus className="w-4 h-4 mr-2 inline" />
                  Create Project
                </button>
              </Link>
            </div>
          )}

          {/* Projects */}
          {!isLoading && data && data.items.length > 0 && (
            <div className="space-y-6">
              {data.items.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              
              {data.pagination.hasMore && (
                <Link href="/projects" className="block text-center">
                  <button className="text-[10px] font-mono uppercase tracking-widest text-muted hover:text-ink transition-colors">
                    View All Projects →
                  </button>
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="col-span-12 md:col-span-4 space-y-8">
          <h2 className="text-2xl font-mono uppercase tracking-widest text-muted">Recent Intelligence</h2>
          <div className="bg-white border border-border p-8 space-y-6 shadow-sm">
            <IntelSnippet 
              icon={<Sparkles className="w-4 h-4 text-intel-blue" />}
              title="AI Discovery Active"
              description="Research alerts are monitoring your saved queries for new publications."
            />
            <IntelSnippet 
              icon={<Clock className="w-4 h-4 text-muted" />}
              title="Weekly Digest"
              description="Configure your research trends summary in settings."
            />
            <Link href="/alerts" className="block">
              <button className="w-full py-4 border border-dashed border-border text-[10px] font-mono uppercase tracking-widest hover:border-ink hover:bg-paper transition-all">
                View All Insights
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectListItem }) {
  const { id, title, status, progress, members, lastActivity, _count } = project;
  
  const statusDisplay = status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ");
  
  const lastActiveDisplay = lastActivity 
    ? formatDistanceToNow(new Date(lastActivity), { addSuffix: true })
    : "No activity";

  const teamInitials = members.slice(0, 3).map(m => {
    const name = m.user.name || m.user.email || "?";
    const parts = name.split(" ");
    return parts.length > 1 
      ? `${parts[0][0]}. ${parts[1][0]}.`
      : `${name[0]}.`;
  });

  return (
    <Link 
      href={`/project/${id}/screening`} 
      className="block group bg-white border border-border p-8 hover:border-ink hover:shadow-editorial transition-all cursor-pointer rounded-sm relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-8">
        <h3 className="text-3xl font-serif leading-tight max-w-md group-hover:underline group-hover:text-ink transition-all">
          {title}
        </h3>
        <ArrowUpRight className="w-6 h-6 text-muted group-hover:text-ink transition-all transform group-hover:translate-x-1 group-hover:-translate-y-1" />
      </div>
      
      <div className="flex items-center gap-6 mb-8">
        <div className="flex-1 h-1 bg-paper relative rounded-full overflow-hidden">
          <div 
            className="absolute left-0 top-0 h-full bg-ink transition-all duration-1000" 
            style={{ width: `${progress}%` }} 
          />
        </div>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest">
          {progress}% Complete
        </span>
      </div>

      <div className="flex justify-between items-center border-t border-border/50 pt-6">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {teamInitials.map((initials, i) => (
              <div 
                key={i} 
                className="w-8 h-8 rounded-full border-2 border-white bg-paper flex items-center justify-center text-[10px] font-bold shadow-sm"
              >
                {initials}
              </div>
            ))}
          </div>
          <div className="h-4 w-[1px] bg-border mx-2" />
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">{statusDisplay}</span>
        </div>
        <div className="flex items-center gap-2 text-muted font-mono text-[10px] uppercase tracking-tighter">
          <Clock className="w-3 h-3" />
          <span>{lastActiveDisplay}</span>
        </div>
      </div>
    </Link>
  );
}

function IntelSnippet({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="space-y-2 group cursor-pointer p-2 hover:bg-paper rounded-sm transition-all border border-transparent hover:border-border/50">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-bold group-hover:underline leading-none">{title}</h4>
      </div>
      <p className="text-xs text-muted font-serif italic leading-relaxed pl-6">{description}</p>
    </div>
  );
}
