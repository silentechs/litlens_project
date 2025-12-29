"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  FileText,
  ChevronRight,
  Send,
  Plus,
  Loader2,
  Save,
  Download,
  Check,
  Trash2,
  BookOpen,
  Copy,
  FileDown,
  ChevronDown,
  Pencil,
  Clock,
  Eye,
  CheckCircle2,
  ArrowRight,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CommonDialog } from "@/components/ui/common-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type WritingStatus = "DRAFT" | "IN_PROGRESS" | "REVIEW" | "COMPLETE";

interface WritingProject {
  id: string;
  title: string;
  type: string;
  status: WritingStatus;
  content: { type: string; content: unknown[] } | null;
  wordCount: number;
  citationStyle: string;
  targetLength: number | null;
  updatedAt: string;
  sources?: unknown[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Status configuration with colors, icons, and labels
const STATUS_CONFIG: Record<WritingStatus, {
  label: string;
  icon: typeof Pencil;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  DRAFT: {
    label: "Draft",
    icon: Pencil,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    description: "Initial drafting phase",
  },
  IN_PROGRESS: {
    label: "In Progress",
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    description: "Actively being worked on",
  },
  REVIEW: {
    label: "In Review",
    icon: Eye,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "Ready for review",
  },
  COMPLETE: {
    label: "Complete",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    description: "Finalized and complete",
  },
};

const STATUS_ORDER: WritingStatus[] = ["DRAFT", "IN_PROGRESS", "REVIEW", "COMPLETE"];

function getNextStatus(current: WritingStatus): WritingStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx === STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

function getPrevStatus(current: WritingStatus): WritingStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx <= 0) return null;
  return STATUS_ORDER[idx - 1];
}

export function WritingAssistant() {
  const queryClient = useQueryClient();
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [localContent, setLocalContent] = useState<string | object>("");
  const [copilotInput, setCopilotInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showNewDraft, setShowNewDraft] = useState(false);
  const [newDraftTitle, setNewDraftTitle] = useState("");
  const [newDraftType, setNewDraftType] = useState<string>("LITERATURE_REVIEW");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<WritingStatus>>(new Set(["DRAFT", "IN_PROGRESS"]));
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentJsonRef = useRef<object | null>(null);

  // Fetch writing projects
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["writing-projects"],
    queryFn: async () => {
      const res = await fetch("/api/writing", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch writing projects");
      const json = await res.json();
      return json.data as WritingProject[];
    },
  });

  // Group projects by status
  const projectsByStatus = useMemo(() => {
    if (!projectsData) return {} as Record<WritingStatus, WritingProject[]>;
    
    const grouped: Record<WritingStatus, WritingProject[]> = {
      DRAFT: [],
      IN_PROGRESS: [],
      REVIEW: [],
      COMPLETE: [],
    };
    
    projectsData.forEach((project) => {
      if (grouped[project.status]) {
        grouped[project.status].push(project);
      }
    });
    
    return grouped;
  }, [projectsData]);

  // Count totals per status
  const statusCounts = useMemo(() => {
    const counts: Record<WritingStatus, number> = {
      DRAFT: 0,
      IN_PROGRESS: 0,
      REVIEW: 0,
      COMPLETE: 0,
    };
    
    if (projectsData) {
      projectsData.forEach((p) => {
        if (counts[p.status] !== undefined) {
          counts[p.status]++;
        }
      });
    }
    
    return counts;
  }, [projectsData]);

  // Fetch active project details
  const { data: activeProject, isLoading: isLoadingActive } = useQuery({
    queryKey: ["writing-project", activeDraftId],
    queryFn: async () => {
      if (!activeDraftId) return null;
      const res = await fetch(`/api/writing/${activeDraftId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch project");
      const json = await res.json();
      return json.data as WritingProject;
    },
    enabled: !!activeDraftId,
  });

  // Set local content when active project loads
  useEffect(() => {
    if (activeProject?.content) {
      setLocalContent(activeProject.content);
      contentJsonRef.current = activeProject.content;
    } else {
      const emptyContent = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Start writing..." }]
          },
          {
            type: "paragraph",
          }
        ]
      };
      setLocalContent(emptyContent);
      contentJsonRef.current = emptyContent;
    }
  }, [activeProject]);

  // Auto-select first project
  useEffect(() => {
    if (projectsData && projectsData.length > 0 && !activeDraftId) {
      setActiveDraftId(projectsData[0].id);
    }
  }, [projectsData, activeDraftId]);

  // Create new project mutation
  const createMutation = useMutation({
    mutationFn: async ({ title, type }: { title: string; type: string }) => {
      const res = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, type }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["writing-projects"] });
      setActiveDraftId(data.data.id);
      setShowNewDraft(false);
      setNewDraftTitle("");
      // Ensure DRAFT section is expanded
      setExpandedSections((prev) => new Set([...prev, "DRAFT"]));
    },
  });

  // Save content mutation
  const saveMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: object }) => {
      const res = await fetch(`/api/writing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      setLastSaved(new Date());
      setIsSaving(false);
    },
    onError: () => {
      setIsSaving(false);
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: WritingStatus }) => {
      const res = await fetch(`/api/writing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["writing-projects"] });
      queryClient.invalidateQueries({ queryKey: ["writing-project", variables.id] });
      // Expand the new status section
      setExpandedSections((prev) => new Set([...prev, variables.status]));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/writing/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["writing-projects"] });
      setActiveDraftId(null);
      setDraftToDelete(null);
    },
  });

  // Debounced auto-save
  const handleContentChange = useCallback((json: object, html: string) => {
    setLocalContent(html);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (activeDraftId) {
      setIsSaving(true);
      saveTimeoutRef.current = setTimeout(() => {
        saveMutation.mutate({ id: activeDraftId, content: json });
      }, 2000);
    }
  }, [activeDraftId, saveMutation]);

  const handleContentChangeWithRef = useCallback((json: object, html: string) => {
    contentJsonRef.current = json;
    handleContentChange(json, html);
  }, [handleContentChange]);

  const handleSave = () => {
    if (activeDraftId && contentJsonRef.current) {
      saveMutation.mutate({ id: activeDraftId, content: contentJsonRef.current });
    }
  };

  // Export
  const handleExport = async (format: "markdown" | "html" | "text") => {
    if (!activeDraftId) return;
    const res = await fetch(`/api/writing/${activeDraftId}?format=${format}`, {
      credentials: "include",
    });
    const text = await res.text();

    const mimeTypes = {
      markdown: "text/markdown",
      html: "text/html",
      text: "text/plain",
    };

    const extensions = {
      markdown: "md",
      html: "html",
      text: "txt",
    };

    const blob = new Blob([text], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeProject?.title || "draft"}.${extensions[format]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy to clipboard
  const handleCopyToClipboard = async () => {
    if (!activeDraftId) return;
    const res = await fetch(`/api/writing/${activeDraftId}?format=text`, {
      credentials: "include",
    });
    const text = await res.text();
    await navigator.clipboard.writeText(text);
  };

  // Chat with AI copilot
  const handleSendMessage = async () => {
    if (!copilotInput.trim() || isChatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: copilotInput };
    setChatMessages((prev) => [...prev, userMessage]);
    setCopilotInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: [...chatMessages, userMessage],
          context: {
            writingContent: localContent,
            projectType: activeProject?.type,
            citations: activeProject?.sources || [],
            wordCount: getWordCount(),
            targetLength: activeProject?.targetLength,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.data?.response || "I can help you with your writing. What would you like to know?" }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: "I'm having trouble connecting. Please try again." }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const getWordCount = () => {
    if (!localContent) return 0;
    if (typeof localContent !== "string") return 0;
    const text = localContent.replace(/<[^>]*>/g, "");
    return text.split(/\s+/).filter(Boolean).length;
  };

  const toggleSection = (status: WritingStatus) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const handleStatusChange = (newStatus: WritingStatus) => {
    if (activeDraftId && activeProject?.status !== newStatus) {
      updateStatusMutation.mutate({ id: activeDraftId, status: newStatus });
    }
  };

  const handleAdvanceStatus = () => {
    if (activeDraftId && activeProject) {
      const nextStatus = getNextStatus(activeProject.status);
      if (nextStatus) {
        updateStatusMutation.mutate({ id: activeDraftId, status: nextStatus });
      }
    }
  };

  return (
    <div className="space-y-8 pb-20 h-full flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div className="space-y-3">
          <h1 className="text-5xl font-serif">Writing Studio</h1>
          <p className="text-muted font-serif italic text-lg">Synthesize findings into coherent scholarly narrative.</p>
        </div>
        <div className="flex gap-3">
          {activeDraftId && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-2 border border-border text-[10px] font-mono uppercase tracking-widest hover:bg-paper transition-all flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => handleExport("markdown")} className="gap-2">
                    <FileDown className="w-4 h-4" />
                    Export as Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("html")} className="gap-2">
                    <FileDown className="w-4 h-4" />
                    Export as HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("text")} className="gap-2">
                    <FileText className="w-4 h-4" />
                    Export as Plain Text
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleCopyToClipboard} className="gap-2">
                    <Copy className="w-4 h-4" />
                    Copy to Clipboard
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="px-4 py-2 border border-border text-[10px] font-mono uppercase tracking-widest hover:bg-paper transition-all flex items-center gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
            </>
          )}
          <button
            onClick={() => setShowNewDraft(true)}
            className="btn-editorial flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Draft
          </button>
        </div>
      </header>

      <div className="accent-line" />

      {/* Status Bar for Active Project */}
      {activeDraftId && activeProject && (
        <div className="flex items-center justify-between bg-paper border border-border p-4">
          <div className="flex items-center gap-6">
            {/* Current Status Badge */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Status</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className={cn(
                      "px-3 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-2 border transition-all hover:opacity-80",
                      STATUS_CONFIG[activeProject.status].bgColor,
                      STATUS_CONFIG[activeProject.status].borderColor,
                      STATUS_CONFIG[activeProject.status].color
                    )}
                    disabled={updateStatusMutation.isPending}
                  >
                    {updateStatusMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        {(() => {
                          const Icon = STATUS_CONFIG[activeProject.status].icon;
                          return <Icon className="w-3 h-3" />;
                        })()}
                      </>
                    )}
                    {STATUS_CONFIG[activeProject.status].label}
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {STATUS_ORDER.map((status) => {
                    const config = STATUS_CONFIG[status];
                    const Icon = config.icon;
                    const isActive = activeProject.status === status;
                    return (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className={cn(
                          "gap-3 py-2.5",
                          isActive && "bg-paper"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center",
                          config.bgColor
                        )}>
                          <Icon className={cn("w-3.5 h-3.5", config.color)} />
                        </div>
                        <div className="flex-1">
                          <div className={cn(
                            "text-sm font-medium",
                            isActive && "font-semibold"
                          )}>
                            {config.label}
                          </div>
                          <div className="text-[10px] text-muted">{config.description}</div>
                        </div>
                        {isActive && <Check className="w-4 h-4 text-emerald-600" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Workflow Progress */}
            <div className="hidden md:flex items-center gap-1">
              {STATUS_ORDER.map((status, idx) => {
                const config = STATUS_CONFIG[status];
                const Icon = config.icon;
                const isActive = activeProject.status === status;
                const isPast = STATUS_ORDER.indexOf(activeProject.status) > idx;
                const isLast = idx === STATUS_ORDER.length - 1;
                
                return (
                  <div key={status} className="flex items-center">
                    <button
                      onClick={() => handleStatusChange(status)}
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                        isActive 
                          ? cn(config.bgColor, config.color, "ring-2 ring-offset-1", config.borderColor.replace("border-", "ring-"))
                          : isPast
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      )}
                      title={config.label}
                    >
                      {isPast && !isActive ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {!isLast && (
                      <div className={cn(
                        "w-6 h-0.5 mx-0.5",
                        isPast ? "bg-emerald-300" : "bg-gray-200"
                      )} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Word count & save status */}
            <div className="flex items-center gap-4 text-xs font-mono text-muted border-l border-border pl-6">
              <span>{getWordCount()} words</span>
              <span className="w-1 h-1 bg-border rounded-full" />
              {isSaving ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </span>
              ) : lastSaved ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <Check className="w-3 h-3" />
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              ) : null}
            </div>
          </div>

          {/* Quick Advance Button */}
          {getNextStatus(activeProject.status) && (
            <button
              onClick={handleAdvanceStatus}
              disabled={updateStatusMutation.isPending}
              className={cn(
                "px-4 py-2 text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 transition-all",
                "bg-ink text-paper hover:bg-ink/90 disabled:opacity-50"
              )}
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Move to {STATUS_CONFIG[getNextStatus(activeProject.status)!].label}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      <div className="editorial-grid gap-8 flex-1 min-h-0">
        {/* Sidebar: Drafts grouped by status */}
        <aside className="col-span-12 md:col-span-3 space-y-6 overflow-y-auto pr-2">
          {isLoadingProjects ? (
            <div className="flex items-center gap-2 text-muted py-8">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : projectsData && projectsData.length > 0 ? (
            <div className="space-y-4">
              {STATUS_ORDER.map((status) => {
                const config = STATUS_CONFIG[status];
                const Icon = config.icon;
                const projects = projectsByStatus[status] || [];
                const isExpanded = expandedSections.has(status);
                const count = statusCounts[status];
                
                return (
                  <div key={status} className="border border-border overflow-hidden">
                    <button
                      onClick={() => toggleSection(status)}
                      className={cn(
                        "w-full px-4 py-3 flex items-center justify-between transition-colors",
                        "hover:bg-paper/50",
                        isExpanded && "border-b border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center",
                          config.bgColor
                        )}>
                          <Icon className={cn("w-3 h-3", config.color)} />
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-widest">
                          {config.label}
                        </span>
                        <span className={cn(
                          "px-1.5 py-0.5 text-[10px] font-mono rounded",
                          count > 0 ? cn(config.bgColor, config.color) : "bg-gray-100 text-gray-400"
                        )}>
                          {count}
                        </span>
                      </div>
                      <ChevronDown className={cn(
                        "w-4 h-4 text-muted transition-transform",
                        isExpanded && "rotate-180"
                      )} />
                    </button>
                    
                    {isExpanded && (
                      <div className="bg-paper/30">
                        {projects.length > 0 ? (
                          <nav className="p-2 space-y-1">
                            {projects.map((project) => (
                              <DraftItem
                                key={project.id}
                                title={project.title}
                                type={project.type}
                                active={project.id === activeDraftId}
                                onClick={() => setActiveDraftId(project.id)}
                                onDelete={() => setDraftToDelete(project.id)}
                                updatedAt={project.updatedAt}
                              />
                            ))}
                          </nav>
                        ) : (
                          <div className="p-4 text-center">
                            <p className="text-xs text-muted font-serif italic">No items</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-border">
              <BookOpen className="w-10 h-10 mx-auto text-muted/40 mb-3" />
              <p className="text-sm text-muted font-serif italic mb-3">No drafts yet</p>
              <button
                onClick={() => setShowNewDraft(true)}
                className="text-intel-blue text-sm font-mono hover:underline"
              >
                Create your first draft
              </button>
            </div>
          )}
        </aside>

        {/* Editor Main Area */}
        <main className="col-span-12 md:col-span-6 flex flex-col min-h-0">
          <div className="bg-white border border-border flex-1 flex flex-col shadow-editorial overflow-hidden">
            {isLoadingActive ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted" />
              </div>
            ) : activeDraftId && activeProject ? (
              <>
                {/* Editor Header */}
                <div className="px-6 py-4 border-b border-border bg-paper/50">
                  <h2 className="font-serif text-xl">{activeProject.title}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
                      {activeProject.type.replace(/_/g, " ")}
                    </span>
                    <CircleDot className="w-2 h-2 text-border" />
                    <span className="text-[10px] font-mono text-muted">
                      Updated {new Date(activeProject.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <RichTextEditor
                    content={localContent}
                    onChange={handleContentChangeWithRef}
                    placeholder="Start writing your research synthesis..."
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted font-serif italic p-8">
                <FileText className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-xl">Select a draft to start editing</p>
                <p className="text-sm mt-2">or create a new one</p>
              </div>
            )}
          </div>
        </main>

        {/* AI Co-pilot Panel */}
        <aside className="col-span-12 md:col-span-3 flex flex-col min-h-0">
          <div className="bg-ink text-paper flex-1 flex flex-col shadow-editorial overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-intel-blue" />
              <h3 className="font-mono text-[10px] uppercase tracking-widest">Intelligence Co-pilot</h3>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {chatMessages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-serif italic text-paper/60">Ask me about:</p>
                  <div className="space-y-2">
                    {[
                      "How to structure this section",
                      "Suggest citations for my claims",
                      "Identify gaps in my argument",
                      "Improve clarity and flow",
                    ].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setCopilotInput(suggestion)}
                        className="block w-full text-left p-3 bg-white/5 border border-white/10 text-sm font-serif italic leading-relaxed hover:bg-white/10 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-3 text-sm font-serif italic leading-relaxed",
                      msg.role === "user"
                        ? "bg-intel-blue/20 ml-4"
                        : "bg-white/5 border border-white/10 mr-4"
                    )}
                  >
                    {msg.content}
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="p-3 bg-white/5 border border-white/10 mr-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
            </div>

            <div className="p-5 border-t border-white/10">
              <div className="relative">
                <input
                  type="text"
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Ask your research co-pilot..."
                  className="w-full bg-white/5 border border-white/20 p-3 pr-12 text-xs font-serif italic outline-none focus:border-intel-blue"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isChatLoading || !copilotInput.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-intel-blue transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* New Draft Dialog */}
      <Dialog open={showNewDraft} onOpenChange={setShowNewDraft}>
        <DialogContent className="sm:max-w-md">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (newDraftTitle.trim()) {
                createMutation.mutate({ title: newDraftTitle, type: newDraftType });
              }
            }}
          >
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Create New Draft</DialogTitle>
              <DialogDescription className="text-muted text-sm">
                Start a new writing project for your research synthesis.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                  Title
                </label>
                <Input
                  placeholder="e.g., Literature Review"
                  value={newDraftTitle}
                  onChange={(e) => setNewDraftTitle(e.target.value)}
                  className="font-serif text-lg"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                  Section Type
                </label>
                <select
                  value={newDraftType}
                  onChange={(e) => setNewDraftType(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-sm font-serif bg-white focus:border-ink outline-none"
                >
                  <option value="LITERATURE_REVIEW">Literature Review</option>
                  <option value="BACKGROUND">Background</option>
                  <option value="METHODS">Methods</option>
                  <option value="RESULTS">Results</option>
                  <option value="DISCUSSION">Discussion</option>
                  <option value="ABSTRACT">Abstract</option>
                </select>
              </div>
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setShowNewDraft(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newDraftTitle.trim() || createMutation.isPending}
                className="bg-ink text-paper hover:bg-ink/90 w-full sm:w-auto"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Create Draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Draft Deletion Confirmation */}
      <CommonDialog
        isOpen={!!draftToDelete}
        onClose={() => setDraftToDelete(null)}
        onConfirm={() => draftToDelete && deleteMutation.mutate(draftToDelete)}
        title="Delete Draft"
        description="Are you sure you want to delete this draft? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

interface DraftItemProps {
  title: string;
  type: string;
  active?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  updatedAt: string;
}

function DraftItem({ title, type, active, onClick, onDelete, updatedAt }: DraftItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 group cursor-pointer transition-all relative rounded-sm",
        active 
          ? "bg-white border border-ink shadow-sm" 
          : "hover:bg-white/80 border border-transparent"
      )}
    >
      <h4 className="font-serif text-sm leading-tight mb-1 group-hover:text-ink pr-6 line-clamp-1">{title}</h4>
      <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-wider text-muted">
        <span>{type.replace(/_/g, " ")}</span>
        <span className="w-0.5 h-0.5 bg-border rounded-full" />
        <span>{new Date(updatedAt).toLocaleDateString()}</span>
      </div>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-ink rounded-r" />
      )}
    </div>
  );
}
