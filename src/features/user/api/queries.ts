"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "@/lib/api-client";
import type { UserPreferences } from "@/lib/api-client";

export const userKeys = {
    all: ["user"] as const,
    preferences: () => [...userKeys.all, "preferences"] as const,
};

export function useUserPreferences() {
    return useQuery({
        queryKey: userKeys.preferences(),
        queryFn: () => userApi.getPreferences(),
    });
}

export function useUpdateUserPreferences() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<UserPreferences>) => userApi.updatePreferences(data),
        onSuccess: (updated) => {
            queryClient.setQueryData(userKeys.preferences(), updated);
        },
    });
}
