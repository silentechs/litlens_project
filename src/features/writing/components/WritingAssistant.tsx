"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  AlertCircle,
  Trash2,
  BookOpen,
  Copy,
  FileDown,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CommonDialog } from "@/components/ui/common-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WritingProject {
  id: string;
  title: string;
  type: string;
  status: "DRAFT" | "IN_PROGRESS" | "REVIEW" | "COMPLETE";
  content: { type: string; content: unknown[] } | null;
  wordCount: number;
  citationStyle: string;
  targetLength: number | null;
  updatedAt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      // Content is stored as TipTap JSON - pass it directly to the editor
      setLocalContent(activeProject.content);
      contentJsonRef.current = activeProject.content;
    } else {
      // Initialize with empty TipTap document structure
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

  // Manual save (store JSON in ref to avoid stale closure)
  const contentJsonRef = useRef<object | null>(null);
  
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
    // You could add a toast notification here
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

  const getStatusLabel = (status: WritingProject["status"]) => {
    switch (status) {
      case "DRAFT": return "Draft";
      case "IN_PROGRESS": return "In Progress";
      case "REVIEW": return "Review";
      case "COMPLETE": return "Complete";
      default: return "Draft";
    }
  };

  const getWordCount = () => {
    if (!localContent) return 0;
    const text = localContent.replace(/<[^>]*>/g, "");
    return text.split(/\s+/).filter(Boolean).length;
  };

  return (
    <div className="space-y-12 pb-20 h-full flex flex-col">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Writing Studio</h1>
          <p className="text-muted font-serif italic text-xl">Synthesize findings into coherent scholarly narrative.</p>
        </div>
        <div className="flex gap-4">
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

      {/* Save status indicator */}
      {activeDraftId && (
        <div className="flex items-center gap-4 text-xs font-mono text-muted">
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
      )}

      <div className="editorial-grid gap-12 flex-1">
        {/* Sidebar: Drafts */}
        <aside className="col-span-12 md:col-span-3 space-y-12 overflow-y-auto">
          <div className="space-y-6">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Drafting</h3>
            {isLoadingProjects ? (
              <div className="flex items-center gap-2 text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : projectsData && projectsData.length > 0 ? (
              <nav className="space-y-4">
                {projectsData.map((project) => (
                  <DraftItem
                    key={project.id}
                    title={project.title}
                    status={getStatusLabel(project.status)}
                    active={project.id === activeDraftId}
                    onClick={() => setActiveDraftId(project.id)}
                    onDelete={() => setDraftToDelete(project.id)}
                  />
                ))}
              </nav>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="w-8 h-8 mx-auto text-muted/50 mb-2" />
                <p className="text-sm text-muted font-serif italic">No drafts yet</p>
                <button
                  onClick={() => setShowNewDraft(true)}
                  className="mt-2 text-intel-blue text-sm font-mono"
                >
                  Create your first draft
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Editor Main Area */}
        <main className="col-span-12 md:col-span-6 space-y-8 flex flex-col">
          <div className="bg-white border border-border flex-1 flex flex-col shadow-editorial overflow-hidden">
            {isLoadingActive ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted" />
              </div>
            ) : activeDraftId ? (
              <RichTextEditor
                content={localContent}
                onChange={handleContentChangeWithRef}
                placeholder="Start writing your research synthesis..."
              />
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
        <aside className="col-span-12 md:col-span-3 space-y-6 flex flex-col">
          <div className="bg-ink text-paper flex-1 flex flex-col shadow-editorial max-h-[600px]">
            <div className="p-6 border-b border-white/10 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-intel-blue" />
              <h3 className="font-mono text-[10px] uppercase tracking-widest">Intelligence Co-pilot</h3>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {chatMessages.length === 0 ? (
                <>
                  <div className="space-y-2">
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
                          onClick={() => {
                            setCopilotInput(suggestion);
                          }}
                          className="block w-full text-left p-3 bg-white/5 border border-white/10 text-sm font-serif italic leading-relaxed hover:bg-white/10 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
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

            <div className="p-6 border-t border-white/10">
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
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Create New Draft</DialogTitle>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDraft(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newDraftTitle.trim()) {
                  createMutation.mutate({ title: newDraftTitle, type: newDraftType });
                }
              }}
              disabled={!newDraftTitle.trim() || createMutation.isPending}
              className="bg-ink text-paper hover:bg-ink/90"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Draft
            </Button>
          </DialogFooter>
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
  status: string;
  active?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

function DraftItem({ title, status, active, onClick, onDelete }: DraftItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-4 border border-border group cursor-pointer transition-all relative",
        active ? "border-ink bg-white shadow-editorial" : "hover:border-ink hover:bg-paper"
      )}
    >
      <h4 className="font-serif italic text-lg leading-tight mb-2 group-hover:underline pr-6">{title}</h4>
      <div className="flex justify-between items-center">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{status}</span>
        <ChevronRight className="w-4 h-4 text-border group-hover:text-ink" />
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
    </div>
  );
}
