"use client";

import { useState } from "react";
import { Tag, X, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface StudyTag {
  id: string;
  name: string;
  color: string;
}

interface StudyTagsProps {
  projectId: string;
  projectWorkId: string;
  tags: StudyTag[];
  onUpdate?: () => void;
  editable?: boolean;
  className?: string;
}

const TAG_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#F97316", // Orange
];

export function StudyTags({
  projectId,
  projectWorkId,
  tags,
  onUpdate,
  editable = true,
  className,
}: StudyTagsProps) {
  const [showInput, setShowInput] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddTag = async () => {
    const tagName = newTagName.trim();
    if (!tagName) return;

    if (tags.some((t) => t.name === tagName)) {
      toast.error("This tag already exists on this study");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectWorkId,
          name: tagName,
          color: selectedColor,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to add tag");
      }

      setNewTagName("");
      setShowInput(false);
      setSelectedColor(TAG_COLORS[0]);
      onUpdate?.();
      toast.success("Tag added");
    } catch (error) {
      toast.error("Failed to add tag");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/tags/${tagId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to remove tag");
      }

      onUpdate?.();
      toast.success("Tag removed");
    } catch (error) {
      toast.error("Failed to remove tag");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === "Escape") {
      setShowInput(false);
      setNewTagName("");
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Existing Tags */}
      {tags.map((tag) => (
        <div
          key={tag.id}
          className="group flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-serif italic transition-all"
          style={{
            backgroundColor: `${tag.color}15`,
            borderColor: `${tag.color}40`,
            color: tag.color,
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          <Tag className="w-3 h-3" />
          <span>{tag.name}</span>
          {editable && (
            <button
              onClick={() => handleRemoveTag(tag.id)}
              disabled={isLoading}
              className="opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              style={{ color: tag.color }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      {/* Add Tag Button/Input */}
      {editable && (
        showInput ? (
          <div className="flex items-center gap-2 p-2 border border-border rounded-sm bg-white shadow-sm animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="flex gap-1">
              {TAG_COLORS.slice(0, 4).map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "w-4 h-4 rounded-full border-2 transition-all",
                    selectedColor === color ? "scale-125 border-ink" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <Input
              type="text"
              placeholder="Tag name..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="w-32 h-6 text-xs font-serif italic px-2"
              autoFocus
            />
            <button
              onClick={handleAddTag}
              disabled={!newTagName.trim() || isLoading}
              className="text-intel-blue hover:text-intel-blue/70 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            </button>
            <button
              onClick={() => {
                setShowInput(false);
                setNewTagName("");
              }}
              className="text-muted hover:text-ink"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="flex items-center gap-1.5 px-3 py-1 border border-dashed border-border rounded-full text-sm font-serif italic text-muted hover:text-ink hover:border-ink transition-all"
          >
            <Plus className="w-3 h-3" />
            Add tag
          </button>
        )
      )}
    </div>
  );
}

