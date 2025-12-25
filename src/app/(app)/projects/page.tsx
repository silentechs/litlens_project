"use client";

import { useProjects } from "@/features/projects/api/queries";
import { Plus, ArrowUpRight, Clock, Loader2, AlertCircle, FolderOpen } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { ProjectListItem } from "@/types/project";

export default function ProjectsPage() {
  const { data, isLoading, isError, error } = useProjects({ limit: 20 });

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-2">
          <h1 className="text-6xl font-serif">Research Projects</h1>
          <p className="text-muted font-serif italic text-xl">Manage your active systematic reviews and evidence synthesis projects.</p>
        </div>
        <Link href="/projects/new">
          <button className="btn-editorial flex items-center gap-2">
            <Plus className="w-5 h-5" />
            New Project
          </button>
        </Link>
      </header>

      <div className="accent-line" />

      {/* Loading State */}
      {isLoading && (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted" />
          <p className="mt-4 text-muted font-serif italic">Loading projects...</p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="py-20 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
          <p className="mt-4 text-ink font-serif">Failed to load projects</p>
          <p className="text-muted text-sm">{error instanceof Error ? error.message : "An error occurred"}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && data?.items.length === 0 && (
        <div className="py-20 text-center space-y-6">
          <FolderOpen className="w-16 h-16 mx-auto text-muted/50" />
          <div>
            <h2 className="text-3xl font-serif text-ink">No projects yet</h2>
            <p className="text-muted font-serif italic mt-2">Create your first systematic review project to get started.</p>
          </div>
          <Link href="/projects/new">
            <button className="btn-editorial inline-flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Your First Project
            </button>
          </Link>
        </div>
      )}

      {/* Projects Grid */}
      {!isLoading && !isError && data && data.items.length > 0 && (
        <div className="editorial-grid">
          <div className="col-span-12 md:col-span-8 space-y-8">
            <div className="space-y-6">
              {data.items.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectListItem }) {
  const { id, title, status, progress, members, lastActivity, _count } = project;
  
  // Format status for display
  const statusDisplay = status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ");
  
  // Format last activity
  const lastActiveDisplay = lastActivity 
    ? formatDistanceToNow(new Date(lastActivity), { addSuffix: true })
    : "No activity";

  // Get team initials
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
      className="block group bg-white border border-border p-8 hover:border-ink transition-all cursor-pointer rounded-sm shadow-sm"
    >
      <div className="flex justify-between items-start mb-8">
        <h3 className="text-3xl font-serif leading-tight max-w-md group-hover:underline">{title}</h3>
        <ArrowUpRight className="w-6 h-6 text-muted group-hover:text-ink transition-colors" />
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
            {_count.members > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-white bg-paper flex items-center justify-center text-[10px] font-bold shadow-sm">
                +{_count.members - 3}
              </div>
            )}
          </div>
          <div className="h-4 w-[1px] bg-border mx-2" />
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
            {statusDisplay}
          </span>
          <span className="text-[10px] font-mono text-muted">
            • {_count.projectWorks} studies
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted font-mono text-[10px] uppercase tracking-tighter">
          <Clock className="w-3 h-3" />
          <span>{lastActiveDisplay}</span>
        </div>
      </div>
    </Link>
  );
}
