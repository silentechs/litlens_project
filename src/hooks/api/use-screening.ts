/**
 * Screening Hooks
 * React Query hooks for screening workflow
 */

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import {
  screeningApi,
  conflictsApi,
  type ScreeningQueueItem,
  type ScreeningDecisionInput,
  type Conflict,
  type PaginatedResponse,
} from "@/lib/api-client";
import type { PaginationParams } from "@/types/api";

// ============== QUERY KEYS ==============

export const screeningKeys = {
  all: ["screening"] as const,
  queue: (projectId: string) => [...screeningKeys.all, projectId, "queue"] as const,
  queueFiltered: (projectId: string, filters: Record<string, unknown>) =>
    [...screeningKeys.queue(projectId), filters] as const,
  progress: (projectId: string) => [...screeningKeys.all, projectId, "progress"] as const,
  aiSuggestion: (projectId: string, workId: string) =>
    [...screeningKeys.all, projectId, "ai", workId] as const,
  conflicts: (projectId: string) => [...screeningKeys.all, projectId, "conflicts"] as const,
  conflictsFiltered: (projectId: string, filters: Record<string, unknown>) =>
    [...screeningKeys.conflicts(projectId), filters] as const,
  conflict: (projectId: string, conflictId: string) =>
    [...screeningKeys.conflicts(projectId), conflictId] as const,
};

// ============== QUEUE QUERIES ==============

/**
 * Fetch screening queue with pagination
 */
export function useScreeningQueue(
  projectId: string | undefined,
  params?: PaginationParams & { phase?: string; status?: string }
) {
  return useQuery({
    queryKey: screeningKeys.queueFiltered(projectId!, params ? { ...params } : {}),
    queryFn: () => screeningApi.getQueue(projectId!, params),
    enabled: !!projectId,
  });
}

/**
 * Infinite scroll screening queue
 */
export function useInfiniteScreeningQueue(
  projectId: string | undefined,
  params?: { phase?: string; status?: string; limit?: number }
) {
  return useInfiniteQuery({
    queryKey: screeningKeys.queueFiltered(projectId!, { ...params, infinite: true }),
    queryFn: ({ pageParam = 1 }) =>
      screeningApi.getQueue(projectId!, {
        page: pageParam,
        limit: params?.limit || 20,
        phase: params?.phase,
        status: params?.status,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: !!projectId,
  });
}

/**
 * Fetch screening progress
 */
export function useScreeningProgress(projectId: string | undefined) {
  return useQuery({
    queryKey: screeningKeys.progress(projectId!),
    queryFn: () => screeningApi.getProgress(projectId!),
    enabled: !!projectId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Fetch AI suggestion for a study
 */
export function useAiSuggestion(
  projectId: string | undefined,
  projectWorkId: string | undefined
) {
  return useQuery({
    queryKey: screeningKeys.aiSuggestion(projectId!, projectWorkId!),
    queryFn: () => screeningApi.getAiSuggestion(projectId!, projectWorkId!),
    enabled: !!projectId && !!projectWorkId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// ============== SCREENING MUTATIONS ==============

/**
 * Submit a screening decision
 */
export function useSubmitDecision(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (decision: ScreeningDecisionInput) =>
      screeningApi.submitDecision(projectId, decision),
    onSuccess: () => {
      // Invalidate queue and progress
      queryClient.invalidateQueries({ queryKey: screeningKeys.queue(projectId) });
      queryClient.invalidateQueries({ queryKey: screeningKeys.progress(projectId) });
    },
  });
}

/**
 * Submit batch screening decisions (uses batch API with bulk_decision operation)
 */
export function useBatchDecision(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { projectWorkIds: string[]; phase: string; decision: string }) =>
      screeningApi.batch(projectId, {
        operation: 'bulk_decision' as const,
        projectWorkIds: data.projectWorkIds,
        decision: data.decision as 'INCLUDE' | 'EXCLUDE' | 'MAYBE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: screeningKeys.queue(projectId) });
      queryClient.invalidateQueries({ queryKey: screeningKeys.progress(projectId) });
    },
  });
}

// ============== CONFLICT QUERIES ==============

/**
 * Fetch conflicts list
 */
export function useConflicts(
  projectId: string | undefined,
  params?: PaginationParams & { status?: string }
) {
  return useQuery({
    queryKey: screeningKeys.conflictsFiltered(projectId!, params ? { ...params } : {}),
    queryFn: () => conflictsApi.list(projectId!, params),
    enabled: !!projectId,
  });
}

/**
 * Fetch a single conflict
 */
export function useConflict(projectId: string | undefined, conflictId: string | undefined) {
  return useQuery({
    queryKey: screeningKeys.conflict(projectId!, conflictId!),
    queryFn: () => conflictsApi.get(projectId!, conflictId!),
    enabled: !!projectId && !!conflictId,
  });
}

// ============== CONFLICT MUTATIONS ==============

/**
 * Resolve a conflict
 */
export function useResolveConflict(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conflictId,
      data,
    }: {
      conflictId: string;
      data: { finalDecision: 'INCLUDE' | 'EXCLUDE' | 'MAYBE'; reasoning: string };
    }) => conflictsApi.resolve(projectId, conflictId, data),
    onSuccess: (_, { conflictId }) => {
      queryClient.invalidateQueries({ queryKey: screeningKeys.conflicts(projectId) });
      queryClient.invalidateQueries({
        queryKey: screeningKeys.conflict(projectId, conflictId),
      });
      queryClient.invalidateQueries({ queryKey: screeningKeys.progress(projectId) });
    },
  });
}

// NOTE: useEscalateConflict is disabled because conflictsApi.escalate is not implemented
// export function useEscalateConflict(projectId: string) { ... }
