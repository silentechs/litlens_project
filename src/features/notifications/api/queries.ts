"use client";

import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api-client";
import type { Notification } from "@/lib/api-client";
import type { PaginatedResponse } from "@/lib/api-client";

export function useNotifications(params?: { unread?: boolean; projectId?: string; page?: number; limit?: number }) {
    return useQuery({
        queryKey: ["notifications", params],
        queryFn: () => notificationsApi.list(params),
    });
}
