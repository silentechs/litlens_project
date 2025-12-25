"use client";

import { useState, useCallback } from "react";
import { useUnifiedSearch, useSaveToLibrary, useAddToProject } from "../api/queries";
import { useAppStore } from "@/stores/app-store";
import type { WorkSearchResult } from "@/types/work";
import { 
  Globe, 
  FolderSearch, 
  Brain, 
  Plus, 
  Bookmark, 
  ExternalLink,
  ChevronRight,
  Filter,
  Loader2,
  AlertCircle,
  Search,
  BookOpen,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SearchTab = 'external' | 'internal' | 'semantic';

export function UnifiedSearch() {
  const { currentProjectId } = useAppStore();
  const [activeTab, setActiveTab] = useState<SearchTab>('external');
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch search results
  const { 
    data, 
    isLoading, 
    isError, 
    error 
  } = useUnifiedSearch(
    {
      query: searchQuery,
      type: activeTab,
      projectId: currentProjectId || undefined,
      limit: 20,
    },
    { enabled: searchQuery.length >= 2 }
  );

  // Handle search
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(query);
  }, [query]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setSearchQuery(query);
    }
  }, [query]);

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col gap-4">
        <h1 className="text-6xl font-serif">Discovery</h1>
        <p className="text-muted font-serif italic text-xl">Query across the global research corpus or your private intelligence.</p>
      </header>

      {/* Search Input Area */}
      <form onSubmit={handleSearch} className="relative group max-w-5xl">
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Search for papers, authors, or concepts..." 
          className="w-full bg-transparent border-b-2 border-border focus:border-ink py-8 px-4 text-4xl font-serif outline-none transition-all placeholder:text-muted/20"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-6">
          <button 
            type="button"
            className="p-3 hover:bg-paper rounded-full text-muted hover:text-ink transition-all"
          >
            <Filter className="w-8 h-8" />
          </button>
          <div className="h-12 w-[1px] bg-border" />
          <button type="submit">
            <kbd className="hidden md:block font-mono text-[10px] bg-paper px-3 py-1.5 rounded border border-border shadow-sm tracking-widest uppercase hover:bg-ink hover:text-paper transition-all cursor-pointer">
              ENTER
            </kbd>
          </button>
        </div>
      </form>

      {/* Tabs */}
      <div className="flex gap-12 border-b border-border">
        <TabButton 
          active={activeTab === 'external'} 
          onClick={() => setActiveTab('external')}
          icon={<Globe className="w-4 h-4" />}
          label="Global Corpus"
          description="OpenAlex / PubMed"
        />
        <TabButton 
          active={activeTab === 'internal'} 
          onClick={() => setActiveTab('internal')}
          icon={<FolderSearch className="w-4 h-4" />}
          label="Internal Library"
          description="Your Saved Papers"
        />
        <TabButton 
          active={activeTab === 'semantic'} 
          onClick={() => setActiveTab('semantic')}
          icon={<Brain className="w-4 h-4" />}
          label="Semantic Bridge"
          description="Vector Similarity"
        />
      </div>

      {/* Results Area */}
      <div className="space-y-8 max-w-5xl">
        {/* Initial State */}
        {!searchQuery && (
          <div className="py-20 text-center">
            <Search className="w-16 h-16 mx-auto text-muted/30" />
            <p className="mt-6 text-muted font-serif italic text-xl">
              Enter a search query to discover research
            </p>
            <p className="mt-2 text-muted/60 text-sm">
              {activeTab === 'external' && "Search OpenAlex and PubMed databases"}
              {activeTab === 'internal' && "Search your saved papers and project studies"}
              {activeTab === 'semantic' && "Find semantically similar papers (requires 10+ characters)"}
            </p>
          </div>
        )}

        {/* Loading */}
        {searchQuery && isLoading && (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted" />
            <p className="mt-4 text-muted font-serif italic">Searching...</p>
          </div>
        )}

        {/* Error */}
        {searchQuery && isError && (
          <div className="py-20 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
            <p className="mt-4 text-ink font-serif">Search failed</p>
            <p className="text-muted text-sm">{error instanceof Error ? error.message : "An error occurred"}</p>
          </div>
        )}

        {/* Empty Results */}
        {searchQuery && !isLoading && !isError && data?.items.length === 0 && (
          <div className="py-20 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-muted/50" />
            <p className="mt-4 text-ink font-serif text-xl">No results found</p>
            <p className="text-muted font-serif italic mt-2">Try adjusting your search terms or switching tabs</p>
          </div>
        )}

        {/* Results */}
        {searchQuery && !isLoading && data && data.items.length > 0 && (
          <>
            <p className="text-sm text-muted font-mono uppercase tracking-widest">
              Found {data.total} results
              {data.errors && data.errors.length > 0 && (
                <span className="text-amber-600 ml-2">
                  ({data.errors.length} source{data.errors.length > 1 ? 's' : ''} unavailable)
                </span>
              )}
            </p>
            {data.items.map((work) => (
              <WorkResult key={work.id} work={work} projectId={currentProjectId} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, description }: { 
  active: boolean, 
  onClick: () => void, 
  icon: React.ReactNode, 
  label: string, 
  description: string 
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "pb-6 text-left group transition-all relative outline-none",
        active ? "text-ink" : "text-muted hover:text-ink"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("transition-colors", active ? "text-intel-blue" : "group-hover:text-intel-blue")}>{icon}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold">{label}</span>
      </div>
      <span className="font-serif italic text-sm opacity-60 group-hover:opacity-100 transition-opacity">{description}</span>
      {active && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-ink" />}
    </button>
  );
}

function WorkResult({ work, projectId }: { work: WorkSearchResult; projectId: string | null }) {
  const saveToLibrary = useSaveToLibrary();
  const addToProject = useAddToProject();
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [addedToProject, setAddedToProject] = useState(false);

  const handleSaveToLibrary = () => {
    saveToLibrary.mutate(
      {
        workData: {
          title: work.title,
          authors: work.authors,
          abstract: work.abstract || undefined,
          year: work.year || undefined,
          journal: work.journal || undefined,
          doi: work.doi || undefined,
        },
      },
      {
        onSuccess: () => setSavedToLibrary(true),
      }
    );
  };

  const handleAddToProject = () => {
    if (!projectId) return;
    addToProject.mutate(
      {
        projectId,
        workData: {
          title: work.title,
          authors: work.authors,
          abstract: work.abstract || undefined,
          year: work.year || undefined,
          journal: work.journal || undefined,
          doi: work.doi || undefined,
        },
      },
      {
        onSuccess: () => setAddedToProject(true),
      }
    );
  };

  const authorsDisplay = work.authors.map(a => a.name).join(", ");

  return (
    <div className="group bg-white p-10 border border-border hover:border-ink hover:shadow-editorial transition-all relative overflow-hidden rounded-sm">
      {work.relevanceScore && (
        <div className="absolute top-0 right-0 p-3 bg-intel-blue/5 text-intel-blue border-l border-b border-intel-blue/10 font-mono text-[9px] tracking-[0.2em] uppercase font-bold">
          Signal: {(work.relevanceScore * 100).toFixed(0)}%
        </div>
      )}
      
      <div className="flex justify-between items-start gap-12">
        <div className="flex-1 space-y-6">
          <div className="space-y-2">
            <h3 className="text-3xl font-serif leading-tight group-hover:underline cursor-pointer group-hover:text-ink transition-colors">
              {work.title}
            </h3>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-mono uppercase tracking-widest text-muted">
              <span className="font-bold text-ink/60">{authorsDisplay}</span>
              {work.journal && (
                <>
                  <span className="w-1 h-1 bg-border rounded-full" />
                  <span className="italic">{work.journal}</span>
                </>
              )}
              {work.year && (
                <>
                  <span className="w-1 h-1 bg-border rounded-full" />
                  <span>{work.year}</span>
                </>
              )}
              {work.citationCount > 0 && (
                <>
                  <span className="w-1 h-1 bg-border rounded-full" />
                  <span>{work.citationCount} citations</span>
                </>
              )}
            </div>
          </div>
          
          {work.abstract && (
            <p className="text-muted leading-relaxed font-serif text-xl italic opacity-80 group-hover:opacity-100 transition-opacity max-w-3xl line-clamp-3">
              "{work.abstract}"
            </p>
          )}

          <div className="flex items-center gap-8 pt-4">
            {projectId && (
              <button 
                onClick={handleAddToProject}
                disabled={addToProject.isPending || addedToProject}
                className={cn(
                  "flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] transition-all border px-3 py-1.5 rounded-full",
                  addedToProject 
                    ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                    : "hover:text-intel-blue border-transparent hover:border-intel-blue/20"
                )}
              >
                {addToProject.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : addedToProject ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                {addedToProject ? "Added" : "Add to Project"}
              </button>
            )}
            <button 
              onClick={handleSaveToLibrary}
              disabled={saveToLibrary.isPending || savedToLibrary}
              className={cn(
                "flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] transition-all border px-3 py-1.5 rounded-full",
                savedToLibrary 
                  ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                  : "hover:text-intel-blue border-transparent hover:border-intel-blue/20"
              )}
            >
              {saveToLibrary.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : savedToLibrary ? (
                <Check className="w-3 h-3" />
              ) : (
                <Bookmark className="w-3 h-3" />
              )}
              {savedToLibrary ? "Saved" : "Save to Library"}
            </button>
            {work.url && (
              <a 
                href={work.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] hover:text-intel-blue transition-all border border-transparent hover:border-intel-blue/20 px-3 py-1.5 rounded-full"
              >
                <ExternalLink className="w-3 h-3" />
                View Source
              </a>
            )}
          </div>
        </div>
        
        <div className="w-14 h-14 flex items-center justify-center border border-border group-hover:border-ink transition-all cursor-pointer bg-paper hover:bg-white shadow-sm hover:shadow-md mt-2">
          <ChevronRight className="w-8 h-8 text-muted group-hover:text-ink transition-colors" />
        </div>
      </div>
    </div>
  );
}
