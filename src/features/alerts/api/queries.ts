"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertsApi } from "@/lib/api-client";
import type { CreateAlertInput, ResearchAlert } from "@/lib/api-client";

export const alertKeys = {
    all: ["alerts"] as const,
    lists: () => [...alertKeys.all, "list"] as const,
    list: (filters: any) => [...alertKeys.lists(), filters] as const,
    stats: () => [...alertKeys.all, "stats"] as const,
};

export function useAlerts(params?: { activeOnly?: boolean; projectId?: string }) {
    return useQuery({
        queryKey: alertKeys.list(params || {}),
        queryFn: () => alertsApi.list(params),
    });
}

export function useAlertStats() {
    return useQuery({
        queryKey: alertKeys.stats(),
        queryFn: () => alertsApi.getStats(),
    });
}

export function useCreateAlert() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateAlertInput) => alertsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
            queryClient.invalidateQueries({ queryKey: alertKeys.stats() });
        },
    });
}

export function useUpdateAlert() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...data }: { id: string } & Partial<CreateAlertInput> & { isActive?: boolean }) =>
            alertsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
        },
    });
}

export function useDeleteAlert() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => alertsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
            queryClient.invalidateQueries({ queryKey: alertKeys.stats() });
        },
    });
}
