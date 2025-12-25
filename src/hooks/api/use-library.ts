/**
 * Library Hooks
 * React Query hooks for personal library management
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  libraryApi,
  type LibraryItem,
  type LibraryFolder,
  type PaginatedResponse,
} from "@/lib/api-client";
import type { PaginationParams } from "@/types/api";

// ============== QUERY KEYS ==============

export const libraryKeys = {
  all: ["library"] as const,
  items: () => [...libraryKeys.all, "items"] as const,
  itemsList: (filters: Record<string, unknown>) => [...libraryKeys.items(), filters] as const,
  item: (id: string) => [...libraryKeys.items(), id] as const,
  folders: () => [...libraryKeys.all, "folders"] as const,
  folder: (id: string) => [...libraryKeys.folders(), id] as const,
};

// ============== ITEM QUERIES ==============

/**
 * Fetch library items with filters
 */
export function useLibraryItems(
  params?: PaginationParams & { folderId?: string; tags?: string; status?: string }
) {
  return useQuery({
    queryKey: libraryKeys.itemsList(params ? { ...params } : {}),
    queryFn: () => libraryApi.getItems(params),
  });
}

/**
 * Fetch library folders
 */
export function useLibraryFolders() {
  return useQuery({
    queryKey: libraryKeys.folders(),
    queryFn: () => libraryApi.getFolders(),
  });
}

// ============== ITEM MUTATIONS ==============

/**
 * Add item to library
 */
export function useAddToLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { workId: string; folderId?: string; tags?: string[]; notes?: string }) =>
      libraryApi.addItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

/**
 * Update library item
 */
export function useUpdateLibraryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: Partial<LibraryItem> }) =>
      libraryApi.updateItem(itemId, data),
    onSuccess: (updatedItem) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
      queryClient.setQueryData(libraryKeys.item(updatedItem.id), updatedItem);
    },
  });
}

/**
 * Remove item from library
 */
export function useRemoveFromLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => libraryApi.deleteItem(itemId),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
      queryClient.removeQueries({ queryKey: libraryKeys.item(deletedId) });
    },
  });
}

// ============== FOLDER MUTATIONS ==============

/**
 * Create a folder
 */
export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; parentId?: string }) =>
      libraryApi.createFolder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.folders() });
    },
  });
}

/**
 * Update a folder
 */
export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      libraryApi.updateFolder(folderId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.folders() });
    },
  });
}

/**
 * Delete a folder
 */
export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (folderId: string) => libraryApi.deleteFolder(folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.folders() });
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

// ============== READING STATUS ==============

/**
 * Update reading status
 */
export function useUpdateReadingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: string }) =>
      libraryApi.updateItem(itemId, { readingStatus: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

/**
 * Update item rating
 */
export function useUpdateRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, rating }: { itemId: string; rating: number }) =>
      libraryApi.updateItem(itemId, { rating }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

