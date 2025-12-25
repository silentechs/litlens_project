"use client";

import { useState } from "react";
import { useLibraryItems, useLibraryFolders, useRemoveFromLibrary, useUpdateLibraryItem, useCreateFolder } from "../api/queries";
import type { LibraryItemWithWork, LibraryFolderWithCounts } from "@/types/library";
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
  CommonDialog
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";

export function LibraryManager() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"addedAt" | "title" | "year">("addedAt");

  // Dialog states
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#3B82F6");

  // Fetch library items
  const {
    data: itemsData,
    isLoading: isLoadingItems,
    isError: isItemsError
  } = useLibraryItems({
    folderId: selectedFolderId,
    search: searchQuery || undefined,
    sortBy,
  });

  // Fetch folders
  const {
    data: folders,
    isLoading: isLoadingFolders
  } = useLibraryFolders();

  // Create folder mutation
  const createFolder = useCreateFolder();

  const items = itemsData?.items || [];

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
        },
      }
    );
  };

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">My Library</h1>
          <p className="text-muted font-serif italic text-xl">Your personal curation of scholarly intelligence.</p>
        </div>
        <button className="btn-editorial flex items-center gap-2">
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
                  className="bg-transparent pl-6 py-2 outline-none font-serif italic text-lg placeholder:text-muted/40"
                />
              </div>
              <div className="h-4 w-[1px] bg-border" />
              <button className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted hover:text-ink">
                <Filter className="w-3 h-3" /> Filter
              </button>
            </div>

            <div className="flex gap-4">
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
              <p className="mt-4 text-ink font-serif text-xl">Your library is empty</p>
              <p className="text-muted font-serif italic mt-2">
                Save papers from search results to build your collection
              </p>
            </div>
          )}

          {/* Items */}
          {!isLoadingItems && items.length > 0 && (
            <div className="grid grid-cols-1 gap-6">
              {items.map((item) => (
                <LibraryItemCard key={item.id} item={item} />
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

function LibraryItemCard({ item }: { item: LibraryItemWithWork }) {
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

  const handleToggleStar = () => {
    updateItem.mutate({
      id: item.id,
      rating: item.rating === 5 ? null : 5,
    });
  };

  const handleRemove = () => {
    removeFromLibrary.mutate(item.id, {
      onSuccess: () => setShowDeleteConfirm(false)
    });
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const updatedTags = [...item.tags, newTag.trim().toLowerCase()];
    updateItem.mutate(
      { id: item.id, tags: updatedTags },
      { onSuccess: () => setNewTag("") }
    );
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = item.tags.filter((t) => t !== tagToRemove);
    updateItem.mutate({ id: item.id, tags: updatedTags });
  };

  const handleSaveNotes = () => {
    updateItem.mutate(
      { id: item.id, notes: notesContent || undefined },
      { onSuccess: () => setIsEditingNotes(false) }
    );
  };

  const authorsDisplay = item.work.authors.map(a => a.name).join(", ");
  const addedAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });

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
            <h3 className="text-2xl font-serif group-hover:underline cursor-pointer">{item.work.title}</h3>
          </div>
          <div className="flex items-center gap-4 text-sm font-sans text-muted">
            <span className="font-bold">{authorsDisplay}</span>
            {item.work.year && (
              <>
                <span className="w-1 h-1 bg-border rounded-full" />
                <span>{item.work.year}</span>
              </>
            )}
            <span className="w-1 h-1 bg-border rounded-full" />
            <span className="italic flex items-center gap-1">
              <Clock className="w-3 h-3" /> {addedAgo}
            </span>
          </div>
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
          <button className="p-2 hover:bg-paper transition-colors peer">
            <MoreVertical className="w-5 h-5 text-muted hover:text-ink" />
          </button>
          <div className="absolute right-0 top-full mt-1 bg-white border border-border shadow-lg rounded-sm opacity-0 peer-hover:opacity-100 hover:opacity-100 transition-opacity z-10">
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

        <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-ink transition-all cursor-pointer">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
