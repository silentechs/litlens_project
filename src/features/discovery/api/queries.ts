"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { WorkSearchResult } from "@/types/work";
import type { ApiSuccessResponse } from "@/types/api";

// ============== API CLIENT FUNCTIONS ==============

interface ExternalSearchParams {
  query: string;
  sources?: ("openalex" | "pubmed" | "crossref")[];
  page?: number;
  limit?: number;
  filters?: {
    yearFrom?: number;
    yearTo?: number;
    type?: string;
    openAccess?: boolean;
  };
}

interface SearchResult {
  items: WorkSearchResult[];
  total: number;
  sources: string[];
  errors?: { source: string; error: string }[];
}

async function searchExternal(params: ExternalSearchParams): Promise<SearchResult> {
  const searchParams = new URLSearchParams();
  searchParams.set("query", params.query);
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());
  params.sources?.forEach((s) => searchParams.append("sources", s));
  if (params.filters?.yearFrom) searchParams.set("yearFrom", params.filters.yearFrom.toString());
  if (params.filters?.yearTo) searchParams.set("yearTo", params.filters.yearTo.toString());
  if (params.filters?.type) searchParams.set("type", params.filters.type);
  if (params.filters?.openAccess) searchParams.set("openAccess", "true");

  const response = await fetch(`/api/search/external?${searchParams.toString()}`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Search failed");
  }

  const data: ApiSuccessResponse<SearchResult> = await response.json();
  return data.data;
}

interface InternalSearchParams {
  query: string;
  projectId?: string;
  page?: number;
  limit?: number;
  filters?: {
    status?: string;
    phase?: string;
    yearFrom?: number;
    yearTo?: number;
  };
}

async function searchInternal(params: InternalSearchParams): Promise<SearchResult> {
  const searchParams = new URLSearchParams();
  searchParams.set("query", params.query);
  if (params.projectId) searchParams.set("projectId", params.projectId);
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());

  const response = await fetch(`/api/search/internal?${searchParams.toString()}`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Search failed");
  }

  const data: ApiSuccessResponse<SearchResult> = await response.json();
  return data.data;
}

interface SemanticSearchParams {
  query: string;
  projectId?: string;
  limit?: number;
  threshold?: number;
}

async function searchSemantic(params: SemanticSearchParams): Promise<SearchResult> {
  const searchParams = new URLSearchParams();
  searchParams.set("query", params.query);
  if (params.projectId) searchParams.set("projectId", params.projectId);
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.threshold) searchParams.set("threshold", params.threshold.toString());

  const response = await fetch(`/api/search/semantic?${searchParams.toString()}`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Semantic search failed");
  }

  const data: ApiSuccessResponse<SearchResult> = await response.json();
  return data.data;
}

// ============== QUERY KEYS ==============

export const searchKeys = {
  all: ["search"] as const,
  external: (params: ExternalSearchParams) => [...searchKeys.all, "external", params] as const,
  internal: (params: InternalSearchParams) => [...searchKeys.all, "internal", params] as const,
  semantic: (params: SemanticSearchParams) => [...searchKeys.all, "semantic", params] as const,
};

// ============== QUERY HOOKS ==============

export function useExternalSearch(
  params: ExternalSearchParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: searchKeys.external(params),
    queryFn: () => searchExternal(params),
    enabled: options?.enabled !== false && !!params.query && params.query.length >= 2,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

export function useInternalSearch(
  params: InternalSearchParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: searchKeys.internal(params),
    queryFn: () => searchInternal(params),
    enabled: options?.enabled !== false && !!params.query && params.query.length >= 2,
    staleTime: 60 * 1000, // Cache for 1 minute (internal data changes more)
  });
}

export function useSemanticSearch(
  params: SemanticSearchParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: searchKeys.semantic(params),
    queryFn: () => searchSemantic(params),
    enabled: options?.enabled !== false && !!params.query && params.query.length >= 10,
    staleTime: 5 * 60 * 1000,
  });
}

// ============== UNIFIED SEARCH HOOK ==============

type SearchType = "external" | "internal" | "semantic";

interface UnifiedSearchParams {
  query: string;
  type: SearchType;
  projectId?: string;
  sources?: ("openalex" | "pubmed" | "crossref")[];
  page?: number;
  limit?: number;
  filters?: Record<string, unknown>;
}

export function useUnifiedSearch(params: UnifiedSearchParams, options?: { enabled?: boolean }) {
  const { query, type, projectId, sources, page, limit, filters } = params;

  const externalQuery = useExternalSearch(
    { 
      query, 
      sources: sources || ["openalex"], 
      page, 
      limit,
      filters: filters as ExternalSearchParams["filters"],
    },
    { enabled: options?.enabled !== false && type === "external" && query.length >= 2 }
  );

  const internalQuery = useInternalSearch(
    { 
      query, 
      projectId, 
      page, 
      limit,
      filters: filters as InternalSearchParams["filters"],
    },
    { enabled: options?.enabled !== false && type === "internal" && query.length >= 2 }
  );

  const semanticQuery = useSemanticSearch(
    { query, projectId, limit: limit || 20 },
    { enabled: options?.enabled !== false && type === "semantic" && query.length >= 10 }
  );

  // Return the active query based on type
  switch (type) {
    case "external":
      return externalQuery;
    case "internal":
      return internalQuery;
    case "semantic":
      return semanticQuery;
    default:
      return externalQuery;
  }
}

// ============== ADD TO PROJECT MUTATION ==============

interface AddToProjectInput {
  projectId: string;
  workId?: string;
  workData?: {
    title: string;
    authors: { name: string }[];
    abstract?: string;
    year?: number;
    journal?: string;
    doi?: string;
  };
}

async function addToProject(input: AddToProjectInput): Promise<{ projectWorkId: string }> {
  const response = await fetch(`/api/projects/${input.projectId}/works`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to add to project");
  }

  const data = await response.json();
  return data.data;
}

export function useAddToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addToProject,
    onSuccess: (_, variables) => {
      // Invalidate project studies
      queryClient.invalidateQueries({ 
        queryKey: ["projects", variables.projectId, "stats"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["screening", "queue", variables.projectId] 
      });
    },
  });
}

// ============== SAVE TO LIBRARY MUTATION ==============

interface SaveToLibraryInput {
  workId?: string;
  workData?: {
    title: string;
    authors: { name: string }[];
    abstract?: string;
    year?: number;
    journal?: string;
    doi?: string;
  };
  folderId?: string;
  tags?: string[];
}

async function saveToLibrary(input: SaveToLibraryInput): Promise<{ libraryItemId: string }> {
  // First, ensure the work exists in our database
  let workId = input.workId;

  if (!workId && input.workData) {
    // Create the work first
    const createResponse = await fetch("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.workData),
      credentials: 'include',
    });

    if (!createResponse.ok) {
      throw new Error("Failed to create work");
    }

    const workData = await createResponse.json();
    workId = workData.data.id;
  }

  if (!workId) {
    throw new Error("No work ID provided");
  }

  // Add to library
  const response = await fetch("/api/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workId,
      folderId: input.folderId,
      tags: input.tags,
    }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to save to library");
  }

  const data = await response.json();
  return { libraryItemId: data.data.id };
}

export function useSaveToLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveToLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

