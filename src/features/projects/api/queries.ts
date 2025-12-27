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

import { projectsApi } from "@/lib/api-client";

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
    queryFn: () => projectsApi.list(params).then(res => ({
      items: res.items as unknown as ProjectListItem[],
      pagination: res.pagination
    })),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id!),
    queryFn: () => projectsApi.get(id!).then(res => res as unknown as ProjectWithRelations),
    enabled: !!id,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useProjectStats(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.stats(projectId!),
    queryFn: () => projectsApi.getStats(projectId!).then(res => res as unknown as ProjectStats),
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ============== MUTATION HOOKS ==============

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input).then(res => res as unknown as ProjectWithRelations),
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
      projectsApi.update(id, data).then(res => res as unknown as ProjectWithRelations),
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
    mutationFn: (id: string) => projectsApi.delete(id),
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
      projectsApi.update(id, data).then(res => res as unknown as ProjectWithRelations),
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

