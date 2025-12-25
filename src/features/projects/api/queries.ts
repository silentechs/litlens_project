"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { 
  ProjectListItem, 
  ProjectWithRelations, 
  ProjectStats,
  CreateProjectInput,
  UpdateProjectInput,
} from "@/types/project";
import type { ApiSuccessResponse, PaginationMeta } from "@/types/api";

// ============== API CLIENT FUNCTIONS ==============

async function fetchProjects(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<{ items: ProjectListItem[]; pagination: PaginationMeta }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.status) searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);

  const response = await fetch(`/api/projects?${searchParams.toString()}`, {
    credentials: 'include', // Ensure cookies are sent
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch projects");
  }

  const data: ApiSuccessResponse<{ items: ProjectListItem[]; pagination: PaginationMeta }> = 
    await response.json();
  return data.data;
}

async function fetchProject(id: string): Promise<ProjectWithRelations> {
  const response = await fetch(`/api/projects/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch project");
  }

  const data: ApiSuccessResponse<ProjectWithRelations> = await response.json();
  return data.data;
}

async function fetchProjectStats(projectId: string): Promise<ProjectStats> {
  const response = await fetch(`/api/projects/${projectId}/stats`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch project stats");
  }

  const data: ApiSuccessResponse<ProjectStats> = await response.json();
  return data.data;
}

async function createProject(input: CreateProjectInput): Promise<ProjectWithRelations> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to create project");
  }

  const data: ApiSuccessResponse<ProjectWithRelations> = await response.json();
  return data.data;
}

async function updateProject(
  id: string, 
  input: UpdateProjectInput
): Promise<ProjectWithRelations> {
  const response = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to update project");
  }

  const data: ApiSuccessResponse<ProjectWithRelations> = await response.json();
  return data.data;
}

async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`/api/projects/${id}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to delete project");
  }
}

// ============== QUERY KEYS ==============

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  stats: (id: string) => [...projectKeys.detail(id), "stats"] as const,
};

// ============== QUERY HOOKS ==============

export function useProjects(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
} = {}) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => fetchProjects(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id!),
    queryFn: () => fetchProject(id!),
    enabled: !!id,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useProjectStats(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.stats(projectId!),
    queryFn: () => fetchProjectStats(projectId!),
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ============== MUTATION HOOKS ==============

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: (newProject) => {
      // Invalidate project lists
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      
      // Optionally pre-populate the cache with the new project
      queryClient.setQueryData(projectKeys.detail(newProject.id), newProject);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateProjectInput & { id: string }) =>
      updateProject(id, data),
    onSuccess: (updatedProject) => {
      // Update cache
      queryClient.setQueryData(
        projectKeys.detail(updatedProject.id), 
        updatedProject
      );
      
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: projectKeys.detail(deletedId) });
      
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

// ============== OPTIMISTIC UPDATE HELPERS ==============

export function useOptimisticProjectUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateProjectInput & { id: string }) =>
      updateProject(id, data),
    onMutate: async ({ id, ...newData }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) });

      // Snapshot previous value
      const previousProject = queryClient.getQueryData<ProjectWithRelations>(
        projectKeys.detail(id)
      );

      // Optimistically update
      if (previousProject) {
        queryClient.setQueryData(projectKeys.detail(id), {
          ...previousProject,
          ...newData,
        });
      }

      return { previousProject };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.detail(id), context.previousProject);
      }
    },
    onSettled: (_, __, { id }) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
    },
  });
}

