/**
 * Project Hooks
 * React Query hooks for project management
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  projectsApi,
  projectMembersApi,
  type Project,
  type CreateProjectInput,
  type ProjectMember,
  type PaginatedResponse,
} from "@/lib/api-client";
import type { PaginationParams } from "@/types/api";

// ============== QUERY KEYS ==============

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  stats: (id: string) => [...projectKeys.detail(id), "stats"] as const,
  members: (id: string) => [...projectKeys.detail(id), "members"] as const,
};

// ============== QUERIES ==============

/**
 * Fetch paginated list of projects
 */
export function useProjects(
  params?: PaginationParams & { status?: string; search?: string }
) {
  return useQuery({
    queryKey: projectKeys.list(params ? { ...params } : {}),
    queryFn: () => projectsApi.list(params),
  });
}

/**
 * Fetch a single project by ID
 */
export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id!),
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  });
}

/**
 * Fetch project statistics
 */
export function useProjectStats(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.stats(projectId!),
    queryFn: () => projectsApi.getStats(projectId!),
    enabled: !!projectId,
  });
}

/**
 * Fetch project members
 */
export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.members(projectId!),
    queryFn: () => projectMembersApi.list(projectId!),
    enabled: !!projectId,
  });
}

// ============== MUTATIONS ==============

/**
 * Create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProjectInput) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/**
 * Update a project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProjectInput> }) =>
      projectsApi.update(id, data),
    onSuccess: (updatedProject) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.setQueryData(
        projectKeys.detail(updatedProject.id),
        updatedProject
      );
    },
  });
}

/**
 * Delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.removeQueries({ queryKey: projectKeys.detail(deletedId) });
    },
  });
}

/**
 * Add a member to a project
 */
export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { userId: string; role: string }) =>
      projectMembersApi.add(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.members(projectId) });
    },
  });
}

/**
 * Update a project member's role
 */
export function useUpdateProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      projectMembersApi.update(projectId, memberId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.members(projectId) });
    },
  });
}

/**
 * Remove a member from a project
 */
export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => projectMembersApi.remove(projectId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.members(projectId) });
    },
  });
}

