"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { 
  ScreeningQueueItem, 
  ScreeningDecisionInput,
  Conflict,
  ConflictResolutionInput,
  ScreeningStats,
  ScreeningPhase,
} from "@/types/screening";
import type { ApiSuccessResponse, PaginationMeta } from "@/types/api";

// ============== API CLIENT FUNCTIONS ==============

interface ScreeningQueueParams {
  projectId: string;
  page?: number;
  limit?: number;
  phase?: ScreeningPhase;
  status?: string;
  search?: string;
}

async function fetchScreeningQueue(
  params: ScreeningQueueParams
): Promise<{ items: ScreeningQueueItem[]; pagination: PaginationMeta }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.phase) searchParams.set("phase", params.phase);
  if (params.status) searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);

  const response = await fetch(
    `/api/projects/${params.projectId}/screening/queue?${searchParams.toString()}`,
    { credentials: 'include' }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch screening queue");
  }

  const data: ApiSuccessResponse<{ items: ScreeningQueueItem[]; pagination: PaginationMeta }> =
    await response.json();
  return data.data;
}

async function submitDecision(
  projectId: string,
  input: ScreeningDecisionInput
): Promise<unknown> {
  const response = await fetch(`/api/projects/${projectId}/screening/decisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to submit decision");
  }

  return response.json();
}

async function fetchConflicts(
  projectId: string,
  params: { page?: number; limit?: number; status?: string }
): Promise<{ items: Conflict[]; pagination: PaginationMeta }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.status) searchParams.set("status", params.status);

  const response = await fetch(
    `/api/projects/${projectId}/conflicts?${searchParams.toString()}`,
    { credentials: 'include' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch conflicts");
  }

  const data: ApiSuccessResponse<{ items: Conflict[]; pagination: PaginationMeta }> =
    await response.json();
  return data.data;
}

async function resolveConflict(
  projectId: string,
  conflictId: string,
  input: ConflictResolutionInput
): Promise<unknown> {
  const response = await fetch(
    `/api/projects/${projectId}/conflicts/${conflictId}/resolve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      credentials: 'include',
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to resolve conflict");
  }

  return response.json();
}

// ============== QUERY KEYS ==============

export const screeningKeys = {
  all: ["screening"] as const,
  queues: () => [...screeningKeys.all, "queue"] as const,
  queue: (projectId: string, filters: Record<string, unknown>) =>
    [...screeningKeys.queues(), projectId, filters] as const,
  conflicts: (projectId: string) => [...screeningKeys.all, "conflicts", projectId] as const,
  conflict: (projectId: string, conflictId: string) =>
    [...screeningKeys.conflicts(projectId), conflictId] as const,
  stats: (projectId: string) => [...screeningKeys.all, "stats", projectId] as const,
};

// ============== QUERY HOOKS ==============

export function useScreeningQueue(
  projectId: string | undefined,
  params: Omit<ScreeningQueueParams, "projectId"> = {}
) {
  return useQuery({
    queryKey: screeningKeys.queue(projectId!, params),
    queryFn: () => fetchScreeningQueue({ projectId: projectId!, ...params }),
    enabled: !!projectId,
    staleTime: 10 * 1000, // 10 seconds - screening queue changes frequently
  });
}

export function useConflicts(
  projectId: string | undefined,
  params: { page?: number; limit?: number; status?: string } = {}
) {
  return useQuery({
    queryKey: screeningKeys.conflicts(projectId!),
    queryFn: () => fetchConflicts(projectId!, params),
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ============== MUTATION HOOKS ==============

export function useSubmitDecision(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ScreeningDecisionInput) => submitDecision(projectId, input),
    onSuccess: () => {
      // Invalidate screening queue
      queryClient.invalidateQueries({ queryKey: screeningKeys.queues() });
      // Invalidate project stats
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "stats"] });
      // Invalidate conflicts in case one was created
      queryClient.invalidateQueries({ queryKey: screeningKeys.conflicts(projectId) });
    },
  });
}

export function useResolveConflict(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conflictId, ...input }: ConflictResolutionInput & { conflictId: string }) =>
      resolveConflict(projectId, conflictId, input),
    onSuccess: () => {
      // Invalidate conflicts
      queryClient.invalidateQueries({ queryKey: screeningKeys.conflicts(projectId) });
      // Invalidate project stats
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "stats"] });
    },
  });
}

// ============== OPTIMISTIC DECISION ==============

export function useOptimisticDecision(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ScreeningDecisionInput) => submitDecision(projectId, input),
    onMutate: async (newDecision) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: screeningKeys.queues() });

      // Snapshot previous state (would need proper type handling in real app)
      const previousData = queryClient.getQueryData(screeningKeys.queues());

      // Optimistically remove from queue (since user decided)
      // This is a simplified version - real implementation would update specific query

      return { previousData };
    },
    onError: (err, newDecision, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(screeningKeys.queues(), context.previousData);
      }
    },
    onSettled: () => {
      // Always refetch
      queryClient.invalidateQueries({ queryKey: screeningKeys.queues() });
      queryClient.invalidateQueries({ queryKey: screeningKeys.conflicts(projectId) });
    },
  });
}

// ============== BATCH OPERATIONS ==============

interface BatchDecisionInput {
  projectWorkIds: string[];
  phase: ScreeningPhase;
  decision: "INCLUDE" | "EXCLUDE" | "MAYBE";
  reasoning?: string;
}

async function submitBatchDecision(
  projectId: string,
  input: BatchDecisionInput
): Promise<{ processed: number; failed: number; errors: { projectWorkId: string; error: string }[] }> {
  const response = await fetch(`/api/projects/${projectId}/screening/decisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to submit batch decision");
  }

  const data: ApiSuccessResponse<{ processed: number; failed: number; errors: { projectWorkId: string; error: string }[] }> =
    await response.json();
  return data.data;
}

export function useBatchDecision(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BatchDecisionInput) => submitBatchDecision(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: screeningKeys.queues() });
      queryClient.invalidateQueries({ queryKey: screeningKeys.conflicts(projectId) });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "stats"] });
    },
  });
}

