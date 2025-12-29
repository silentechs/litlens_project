"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLibraryItems, useLibraryFolders, useRemoveFromLibrary, useUpdateLibraryItem, useCreateFolder, useAddToLibrary } from "../api/queries";
import type { LibraryItemWithWork, LibraryFolderWithCounts, ReadingStatus } from "@/types/library";
import { getFolderItemCount } from "@/types/library";
import {
  Folder,
  Search,
  Filter,
  MoreVertical,
  Plus,
  Star,
  Clock,
  ChevronRight,
  BookMarked,
  Loader2,
  AlertCircle,
  Trash2,
  FolderOpen,
  FolderPlus,
  X,
  Tag,
  StickyNote,
  ExternalLink,
  FileText,
  User,
  Calendar,
  Link,
  Check,
  Eye,
  EyeOff,
  BookOpen,
  Archive,
  Bookmark,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CommonDialog } from "@/components/ui/common-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const READING_STATUS_OPTIONS: { value: ReadingStatus | "ALL"; label: string; icon: React.ReactNode }[] = [
  { value: "ALL", label: "All Status", icon: <BookMarked className="w-4 h-4" /> },
  { value: "TO_READ", label: "To Read", icon: <Bookmark className="w-4 h-4" /> },
  { value: "READING", label: "Reading", icon: <BookOpen className="w-4 h-4" /> },
  { value: "READ", label: "Read", icon: <Check className="w-4 h-4" /> },
  { value: "ARCHIVED", label: "Archived", icon: <Archive className="w-4 h-4" /> },
];

export function LibraryManager() {
  const router = useRouter();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"addedAt" | "title" | "year">("addedAt");

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filterReadingStatus, setFilterReadingStatus] = useState<ReadingStatus | "ALL">("ALL");
  const [filterStarred, setFilterStarred] = useState(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // Dialog states
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#3B82F6");

  // Add Manually Dialog states
  const [showAddManually, setShowAddManually] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    title: "",
    authors: "",
    year: "",
    doi: "",
    journal: "",
    abstract: "",
  });

  // Fetch library items
  const {
    data: itemsData,
    isLoading: isLoadingItems,
    isError: isItemsError
  } = useLibraryItems({
    folderId: selectedFolderId,
    search: searchQuery || undefined,
    sortBy,
    readingStatus: filterReadingStatus !== "ALL" ? filterReadingStatus : undefined,
    starred: filterStarred || undefined,
    tags: filterTags.length > 0 ? filterTags : undefined,
  });

  // Fetch folders
  const {
    data: folders,
    isLoading: isLoadingFolders
  } = useLibraryFolders();

  // Create folder mutation
  const createFolder = useCreateFolder();

  const items = itemsData?.items || [];

  // Collect all unique tags from items for filter suggestions
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    items.forEach(item => {
      item.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [items]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterReadingStatus !== "ALL") count++;
    if (filterStarred) count++;
    if (filterTags.length > 0) count += filterTags.length;
    return count;
  }, [filterReadingStatus, filterStarred, filterTags]);

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolder.mutate(
      {
        name: newFolderName.trim(),
        color: newFolderColor,
        parentId: selectedFolderId || undefined,
      },
      {
        onSuccess: () => {
          setShowCreateFolder(false);
          setNewFolderName("");
          setNewFolderColor("#3B82F6");
          toast.success("Folder created successfully");
        },
        onError: () => {
          toast.error("Failed to create folder");
        },
      }
    );
  };

  const handleAddManually = async () => {
    if (!manualEntry.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    try {
      // Parse authors into array
      const authorsArray = manualEntry.authors
        .split(/[,;]/)
        .map(a => a.trim())
        .filter(Boolean)
        .map(name => ({ name }));

      // Create work and add to library via API
      const response = await fetch("/api/works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: manualEntry.title,
          authors: authorsArray,
          year: manualEntry.year ? parseInt(manualEntry.year) : undefined,
          doi: manualEntry.doi || undefined,
          journal: manualEntry.journal || undefined,
          abstract: manualEntry.abstract || undefined,
          saveToLibrary: true,
          folderId: selectedFolderId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to add paper");
      }

      toast.success("Paper added to library");
      setShowAddManually(false);
      setManualEntry({
        title: "",
        authors: "",
        year: "",
        doi: "",
        journal: "",
        abstract: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add paper");
    }
  };

  const handleClearFilters = () => {
    setFilterReadingStatus("ALL");
    setFilterStarred(false);
    setFilterTags([]);
  };

  const handleViewItem = (item: LibraryItemWithWork) => {
    // Navigate to item detail or open in external link
    if (item.work.doi) {
      window.open(`https://doi.org/${item.work.doi}`, "_blank");
    } else if (item.work.url) {
      window.open(item.work.url, "_blank");
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">My Library</h1>
          <p className="text-muted font-serif italic text-xl">Your personal curation of scholarly intelligence.</p>
        </div>
        <button
          onClick={() => setShowAddManually(true)}
          className="btn-editorial flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Manually
        </button>
      </header>

      <div className="accent-line" />

      <div className="editorial-grid gap-12">
        {/* Sidebar: Folders & Tags */}
        <aside className="col-span-12 md:col-span-3 space-y-12">
          <div className="space-y-6">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Organization</h3>
            <nav className="space-y-2">
              <FolderItem
                icon={<BookMarked className="w-4 h-4" />}
                label="All Papers"
                count={itemsData?.pagination.total || 0}
                active={!selectedFolderId}
                onClick={() => setSelectedFolderId(null)}
              />

              {isLoadingFolders ? (
                <div className="py-4 text-center">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted" />
                </div>
              ) : (
                <div className="pt-4 border-t border-border space-y-2">
                  {folders?.map((folder) => (
                    <FolderTreeItem
                      key={folder.id}
                      folder={folder}
                      selectedId={selectedFolderId}
                      onSelect={setSelectedFolderId}
                    />
                  ))}
                </div>
              )}
            </nav>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted hover:text-ink transition-colors"
            >
              <FolderPlus className="w-3 h-3" /> New Folder
            </button>
          </div>

          {/* Quick Stats */}
          <div className="p-6 bg-ink text-paper space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Library Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-serif italic text-paper/60">Total Papers</span>
                <span className="font-mono text-lg">{itemsData?.pagination.total || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-serif italic text-paper/60">Folders</span>
                <span className="font-mono text-lg">{folders?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-serif italic text-paper/60">Tags Used</span>
                <span className="font-mono text-lg">{allTags.length}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content: Paper List */}
        <main className="col-span-12 md:col-span-9 space-y-8">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter library..."
                  className="bg-transparent pl-6 py-2 outline-none font-serif italic text-lg placeholder:text-muted/40 w-48"
                />
              </div>
              <div className="h-4 w-[1px] bg-border" />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex items-center gap-2 text-xs font-mono uppercase tracking-widest transition-colors",
                  showFilters || activeFilterCount > 0 ? "text-intel-blue" : "text-muted hover:text-ink"
                )}
              >
                <Filter className="w-3 h-3" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-intel-blue text-white text-[10px] rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            <div className="flex gap-4 items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-[10px] font-mono uppercase tracking-widest text-muted bg-transparent outline-none cursor-pointer"
              >
                <option value="addedAt">Date Added</option>
                <option value="title">Title</option>
                <option value="year">Year</option>
              </select>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="p-6 bg-white border border-border space-y-6 animate-in slide-in-from-top-2 duration-200">
              <div className="flex justify-between items-center">
                <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  Filter Options
                </h4>
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleClearFilters}
                    className="text-[10px] font-mono uppercase tracking-widest text-intel-blue hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Reading Status */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                    Reading Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {READING_STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setFilterReadingStatus(option.value)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif border rounded-sm transition-all",
                          filterReadingStatus === option.value
                            ? "border-intel-blue bg-intel-blue/10 text-intel-blue"
                            : "border-border hover:border-ink"
                        )}
                      >
                        {option.icon}
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Starred Filter */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                    Rating
                  </label>
                  <button
                    onClick={() => setFilterStarred(!filterStarred)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif border rounded-sm transition-all",
                      filterStarred
                        ? "border-intel-blue bg-intel-blue/10 text-intel-blue"
                        : "border-border hover:border-ink"
                    )}
                  >
                    <Star className={cn("w-4 h-4", filterStarred && "fill-intel-blue")} />
                    Starred Only
                  </button>
                </div>

                {/* Tags Filter */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                    Tags
                  </label>
                  {allTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => {
                            setFilterTags(prev =>
                              prev.includes(tag)
                                ? prev.filter(t => t !== tag)
                                : [...prev, tag]
                            );
                          }}
                          className={cn(
                            "px-2 py-1 text-[10px] font-mono uppercase rounded-full transition-all",
                            filterTags.includes(tag)
                              ? "bg-intel-blue text-white"
                              : "bg-muted/10 text-muted hover:bg-muted/20"
                          )}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted font-serif italic">No tags in library yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {isLoadingItems && (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted" />
              <p className="mt-4 text-muted font-serif italic">Loading library...</p>
            </div>
          )}

          {/* Error */}
          {isItemsError && (
            <div className="py-20 text-center">
              <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
              <p className="mt-4 text-ink font-serif">Failed to load library</p>
            </div>
          )}

          {/* Empty */}
          {!isLoadingItems && !isItemsError && items.length === 0 && (
            <div className="py-20 text-center">
              <FolderOpen className="w-12 h-12 mx-auto text-muted/50" />
              <p className="mt-4 text-ink font-serif text-xl">
                {activeFilterCount > 0 ? "No papers match your filters" : "Your library is empty"}
              </p>
              <p className="text-muted font-serif italic mt-2">
                {activeFilterCount > 0
                  ? "Try adjusting your filter criteria"
                  : "Save papers from search results or add them manually"
                }
              </p>
              {activeFilterCount > 0 ? (
                <button
                  onClick={handleClearFilters}
                  className="btn-editorial mt-4"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  onClick={() => setShowAddManually(true)}
                  className="btn-editorial mt-4"
                >
                  Add Your First Paper
                </button>
              )}
            </div>
          )}

          {/* Items */}
          {!isLoadingItems && items.length > 0 && (
            <div className="grid grid-cols-1 gap-6">
              {items.map((item) => (
                <LibraryItemCard
                  key={item.id}
                  item={item}
                  onView={() => handleViewItem(item)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                Folder Name
              </label>
              <Input
                placeholder="e.g., Systematic Reviews"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                className="font-serif text-lg"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                Color
              </label>
              <div className="flex gap-2">
                {["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#6B7280"].map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewFolderColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      newFolderColor === color && "ring-2 ring-offset-2 ring-ink"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            {selectedFolderId && (
              <p className="text-sm text-muted font-serif italic">
                Creating inside current folder
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateFolder(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || createFolder.isPending}
              className="bg-ink text-paper hover:bg-ink/90"
            >
              {createFolder.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FolderPlus className="w-4 h-4 mr-2" />
              )}
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Manually Dialog */}
      <Dialog open={showAddManually} onOpenChange={setShowAddManually}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Add Paper Manually</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Title <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="Enter paper title"
                value={manualEntry.title}
                onChange={(e) => setManualEntry(prev => ({ ...prev, title: e.target.value }))}
                className="font-serif"
                autoFocus
              />
            </div>

            {/* Authors */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted flex items-center gap-2">
                <User className="w-3 h-3" />
                Authors
              </label>
              <Input
                placeholder="e.g., Smith J, Johnson K (comma separated)"
                value={manualEntry.authors}
                onChange={(e) => setManualEntry(prev => ({ ...prev, authors: e.target.value }))}
                className="font-serif"
              />
            </div>

            {/* Year and Journal */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  Year
                </label>
                <Input
                  type="number"
                  placeholder="2024"
                  value={manualEntry.year}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, year: e.target.value }))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted flex items-center gap-2">
                  <BookOpen className="w-3 h-3" />
                  Journal
                </label>
                <Input
                  placeholder="Journal name"
                  value={manualEntry.journal}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, journal: e.target.value }))}
                  className="font-serif"
                />
              </div>
            </div>

            {/* DOI */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted flex items-center gap-2">
                <Link className="w-3 h-3" />
                DOI
              </label>
              <Input
                placeholder="10.1000/xyz123"
                value={manualEntry.doi}
                onChange={(e) => setManualEntry(prev => ({ ...prev, doi: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>

            {/* Abstract */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                Abstract
              </label>
              <textarea
                placeholder="Paper abstract (optional)"
                value={manualEntry.abstract}
                onChange={(e) => setManualEntry(prev => ({ ...prev, abstract: e.target.value }))}
                className="w-full h-24 px-3 py-2 text-sm font-serif border border-border rounded-sm focus:border-ink outline-none resize-none"
              />
            </div>

            {selectedFolderId && (
              <p className="text-sm text-intel-blue font-serif italic flex items-center gap-2">
                <Folder className="w-3 h-3" />
                Will be added to current folder
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddManually(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddManually}
              disabled={!manualEntry.title.trim()}
              className="bg-ink text-paper hover:bg-ink/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to Library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FolderItem({
  icon,
  label,
  count,
  active,
  onClick
}: {
  icon: React.ReactNode,
  label: string,
  count: number,
  active?: boolean,
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex justify-between items-center p-2 rounded-sm transition-all cursor-pointer group",
        active ? "bg-ink text-paper" : "hover:bg-paper"
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-serif italic text-lg">{label}</span>
      </div>
      <span className={cn(
        "font-mono text-[10px]",
        active ? "text-paper/40" : "text-muted group-hover:text-ink"
      )}>{count}</span>
    </button>
  );
}

function FolderTreeItem({
  folder,
  selectedId,
  onSelect,
  depth = 0
}: {
  folder: LibraryFolderWithCounts;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  const itemCount = getFolderItemCount(folder);
  const subFolders = folder.children || folder.subFolders || [];

  return (
    <>
      <button
        onClick={() => onSelect(folder.id)}
        className={cn(
          "w-full flex justify-between items-center p-2 rounded-sm transition-all cursor-pointer group",
          selectedId === folder.id ? "bg-ink text-paper" : "hover:bg-paper"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <div className="flex items-center gap-3">
          <Folder className="w-4 h-4" style={{ color: folder.color || "#3B82F6" }} />
          <span className="font-serif italic text-lg">{folder.name}</span>
        </div>
        <span className={cn(
          "font-mono text-[10px]",
          selectedId === folder.id ? "text-paper/40" : "text-muted group-hover:text-ink"
        )}>
          {itemCount}
        </span>
      </button>
      {subFolders.map((child) => (
        <FolderTreeItem
          key={child.id}
          folder={child}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

function LibraryItemCard({
  item,
  onView,
}: {
  item: LibraryItemWithWork;
  onView: () => void;
}) {
  const removeFromLibrary = useRemoveFromLibrary();
  const updateItem = useUpdateLibraryItem();

  // Tag editing state
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTag, setNewTag] = useState("");

  // Notes editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState(item.notes || "");

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);

  const handleToggleStar = () => {
    updateItem.mutate({
      id: item.id,
      rating: item.rating === 5 ? null : 5,
    });
  };

  const handleRemove = () => {
    removeFromLibrary.mutate(item.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        toast.success("Paper removed from library");
      },
      onError: () => {
        toast.error("Failed to remove paper");
      },
    });
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const updatedTags = [...item.tags, newTag.trim().toLowerCase()];
    updateItem.mutate(
      { id: item.id, tags: updatedTags },
      {
        onSuccess: () => setNewTag(""),
        onError: () => toast.error("Failed to add tag"),
      }
    );
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = item.tags.filter((t) => t !== tagToRemove);
    updateItem.mutate(
      { id: item.id, tags: updatedTags },
      { onError: () => toast.error("Failed to remove tag") }
    );
  };

  const handleSaveNotes = () => {
    updateItem.mutate(
      { id: item.id, notes: notesContent || undefined },
      {
        onSuccess: () => setIsEditingNotes(false),
        onError: () => toast.error("Failed to save notes"),
      }
    );
  };

  const handleUpdateReadingStatus = (status: ReadingStatus) => {
    updateItem.mutate(
      { id: item.id, readingStatus: status },
      {
        onSuccess: () => {
          setShowDropdown(false);
          toast.success("Status updated");
        },
        onError: () => toast.error("Failed to update status"),
      }
    );
  };

  const authorsDisplay = item.work.authors.map(a => a.name).join(", ");
  const addedAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });

  const statusConfig = READING_STATUS_OPTIONS.find(s => s.value === item.readingStatus);

  return (
    <div className="group bg-white border border-border p-8 hover:border-ink transition-all flex justify-between items-start gap-12">
      <div className="space-y-4 flex-1">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <button onClick={handleToggleStar}>
              {item.rating === 5 ? (
                <Star className="w-4 h-4 fill-intel-blue text-intel-blue" />
              ) : (
                <Star className="w-4 h-4 text-muted hover:text-intel-blue transition-colors" />
              )}
            </button>
            <h3
              onClick={onView}
              className="text-2xl font-serif group-hover:underline cursor-pointer"
            >
              {item.work.title}
            </h3>
          </div>
          <div className="flex items-center gap-4 text-sm font-sans text-muted flex-wrap">
            <span className="font-bold">{authorsDisplay || "Unknown authors"}</span>
            {item.work.year && (
              <>
                <span className="w-1 h-1 bg-border rounded-full" />
                <span>{item.work.year}</span>
              </>
            )}
            {item.work.journal && (
              <>
                <span className="w-1 h-1 bg-border rounded-full" />
                <span className="italic">{item.work.journal}</span>
              </>
            )}
            <span className="w-1 h-1 bg-border rounded-full" />
            <span className="italic flex items-center gap-1">
              <Clock className="w-3 h-3" /> {addedAgo}
            </span>
          </div>
        </div>

        {/* Reading Status Badge */}
        <div className="relative inline-block">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 text-xs font-mono uppercase tracking-widest border rounded-sm transition-all",
              item.readingStatus === "READ" && "border-emerald-200 bg-emerald-50 text-emerald-700",
              item.readingStatus === "READING" && "border-intel-blue/20 bg-intel-blue/5 text-intel-blue",
              item.readingStatus === "TO_READ" && "border-amber-200 bg-amber-50 text-amber-700",
              item.readingStatus === "ARCHIVED" && "border-border bg-muted/10 text-muted"
            )}
          >
            {statusConfig?.icon}
            {statusConfig?.label || item.readingStatus}
            <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-border shadow-lg rounded-sm py-1 min-w-[140px]">
              {READING_STATUS_OPTIONS.filter(o => o.value !== "ALL").map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleUpdateReadingStatus(option.value as ReadingStatus)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-paper transition-colors",
                    item.readingStatus === option.value && "bg-intel-blue/10 text-intel-blue"
                  )}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div className="flex flex-wrap items-center gap-2">
          {item.tags.map(tag => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] font-mono uppercase tracking-[0.15em] text-intel-blue bg-intel-blue/10 hover:bg-intel-blue/20 cursor-pointer group/tag"
              onClick={() => handleRemoveTag(tag)}
            >
              {tag}
              <X className="w-3 h-3 ml-1 opacity-0 group-hover/tag:opacity-100 transition-opacity" />
            </Badge>
          ))}
          {isEditingTags ? (
            <div className="flex items-center gap-1">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTag();
                  if (e.key === "Escape") setIsEditingTags(false);
                }}
                placeholder="Add tag..."
                className="h-6 w-24 text-xs"
                autoFocus
              />
              <button
                onClick={handleAddTag}
                className="text-intel-blue hover:text-intel-blue/80"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsEditingTags(false)}
                className="text-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingTags(true)}
              className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted hover:text-intel-blue transition-colors"
            >
              <Tag className="w-3 h-3" />
              Add Tag
            </button>
          )}
        </div>

        {/* Notes Section */}
        {isEditingNotes ? (
          <div className="space-y-2">
            <textarea
              value={notesContent}
              onChange={(e) => setNotesContent(e.target.value)}
              placeholder="Add your notes..."
              className="w-full p-3 text-sm font-serif italic border border-border rounded-sm focus:border-ink outline-none resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={updateItem.isPending}
                className="bg-ink text-paper hover:bg-ink/90"
              >
                {updateItem.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditingNotes(false);
                  setNotesContent(item.notes || "");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : item.notes ? (
          <p
            onClick={() => setIsEditingNotes(true)}
            className="text-sm text-muted font-serif italic line-clamp-2 cursor-pointer hover:text-ink transition-colors"
          >
            {item.notes}
          </p>
        ) : (
          <button
            onClick={() => setIsEditingNotes(true)}
            className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted hover:text-intel-blue transition-colors"
          >
            <StickyNote className="w-3 h-3" />
            Add Notes
          </button>
        )}
      </div>

      <div className="flex flex-col items-end gap-4">
        <div className="relative">
          <button
            className="p-2 hover:bg-paper transition-colors"
            onClick={() => setShowDropdown(false)}
            onMouseEnter={() => {}}
          >
            <MoreVertical className="w-5 h-5 text-muted hover:text-ink" />
          </button>
          <div className="absolute right-0 top-full mt-1 bg-white border border-border shadow-lg rounded-sm opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
            {item.work.doi && (
              <a
                href={`https://doi.org/${item.work.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-paper w-full"
              >
                <ExternalLink className="w-4 h-4" />
                View Paper
              </a>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 w-full"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          </div>
        </div>

        <CommonDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleRemove}
          title="Remove Paper"
          description={`Are you sure you want to remove "${item.work.title}" from your library? This action cannot be undone.`}
          confirmLabel="Remove"
          variant="destructive"
          loading={removeFromLibrary.isPending}
        />

        <button
          onClick={onView}
          className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-ink transition-all cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
