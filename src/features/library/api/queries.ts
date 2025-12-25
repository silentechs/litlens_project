"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { 
  LibraryItemWithWork, 
  LibraryFolderWithCounts,
  AddToLibraryInput,
  UpdateLibraryItemInput,
  CreateFolderInput,
  LibraryFilters,
} from "@/types/library";
import type { ApiSuccessResponse, PaginationMeta } from "@/types/api";

// ============== API CLIENT FUNCTIONS ==============

async function fetchLibraryItems(
  params: LibraryFilters & { page?: number; limit?: number }
): Promise<{ items: LibraryItemWithWork[]; pagination: PaginationMeta }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.folderId) searchParams.set("folderId", params.folderId);
  if (params.search) searchParams.set("search", params.search);
  if (params.readingStatus) searchParams.set("readingStatus", params.readingStatus);
  if (params.rating) searchParams.set("rating", params.rating.toString());
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);
  params.tags?.forEach((tag) => searchParams.append("tags", tag));

  const response = await fetch(`/api/library?${searchParams.toString()}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch library");
  }

  const data: ApiSuccessResponse<{ items: LibraryItemWithWork[]; pagination: PaginationMeta }> =
    await response.json();
  return data.data;
}

async function fetchLibraryItem(itemId: string): Promise<LibraryItemWithWork> {
  const response = await fetch(`/api/library/${itemId}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch library item");
  }

  const data: ApiSuccessResponse<LibraryItemWithWork> = await response.json();
  return data.data;
}

async function addToLibrary(input: AddToLibraryInput): Promise<LibraryItemWithWork> {
  const response = await fetch("/api/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to add to library");
  }

  const data: ApiSuccessResponse<LibraryItemWithWork> = await response.json();
  return data.data;
}

async function updateLibraryItem(
  itemId: string,
  input: UpdateLibraryItemInput
): Promise<LibraryItemWithWork> {
  const response = await fetch(`/api/library/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to update library item");
  }

  const data: ApiSuccessResponse<LibraryItemWithWork> = await response.json();
  return data.data;
}

async function removeFromLibrary(itemId: string): Promise<void> {
  const response = await fetch(`/api/library/${itemId}`, {
    method: "DELETE",
    credentials: 'include',
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to remove from library");
  }
}

async function fetchFolders(): Promise<LibraryFolderWithCounts[]> {
  const response = await fetch("/api/library/folders", {
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch folders");
  }

  const data: ApiSuccessResponse<LibraryFolderWithCounts[]> = await response.json();
  return data.data;
}

async function createFolder(input: CreateFolderInput): Promise<LibraryFolderWithCounts> {
  const response = await fetch("/api/library/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to create folder");
  }

  const data: ApiSuccessResponse<LibraryFolderWithCounts> = await response.json();
  return data.data;
}

// ============== QUERY KEYS ==============

export const libraryKeys = {
  all: ["library"] as const,
  lists: () => [...libraryKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...libraryKeys.lists(), filters] as const,
  details: () => [...libraryKeys.all, "detail"] as const,
  detail: (id: string) => [...libraryKeys.details(), id] as const,
  folders: () => [...libraryKeys.all, "folders"] as const,
  stats: () => [...libraryKeys.all, "stats"] as const,
};

// ============== QUERY HOOKS ==============

export function useLibraryItems(
  params: LibraryFilters & { page?: number; limit?: number } = {}
) {
  return useQuery({
    queryKey: libraryKeys.list(params as Record<string, unknown>),
    queryFn: () => fetchLibraryItems(params),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useLibraryItem(id: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.detail(id!),
    queryFn: () => fetchLibraryItem(id!),
    enabled: !!id,
  });
}

export function useLibraryFolders() {
  return useQuery({
    queryKey: libraryKeys.folders(),
    queryFn: fetchFolders,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============== MUTATION HOOKS ==============

export function useAddToLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addToLibrary,
    onSuccess: (newItem) => {
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: libraryKeys.lists() });
      // Pre-populate cache
      queryClient.setQueryData(libraryKeys.detail(newItem.id), newItem);
    },
  });
}

export function useUpdateLibraryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateLibraryItemInput & { id: string }) =>
      updateLibraryItem(id, data),
    onSuccess: (updatedItem) => {
      queryClient.setQueryData(libraryKeys.detail(updatedItem.id), updatedItem);
      queryClient.invalidateQueries({ queryKey: libraryKeys.lists() });
    },
  });
}

export function useRemoveFromLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeFromLibrary,
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: libraryKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.lists() });
    },
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.folders() });
    },
  });
}

// ============== HELPER HOOKS ==============

/**
 * Check if a work is already in the user's library
 */
export function useIsInLibrary(workId: string | undefined) {
  const { data: items } = useLibraryItems({ limit: 1 });
  // This is a simplified check - in production you'd want a dedicated endpoint
  return { isInLibrary: false, isLoading: false };
}

