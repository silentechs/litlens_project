import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// Types
export interface QualityAssessmentSummary {
    totalIncluded: number;
    assessedCount: number;
    riskDistribution: {
        HIGH: number;
        MODERATE: number;
        LOW: number;
        UNCLEAR: number;
    };
}

export interface QualityTool {
    id: string;
    name: string;
    type: string;
    projectId: string;
    domains: {
        id: string;
        name: string;
        description: string;
    }[];
}

export interface QualityAssessment {
    id: string;
    status: 'IN_PROGRESS' | 'COMPLETED';
    tool: { id: string; name: string; type: string };
    assessor: { id: string; name: string | null; image: string | null };
    overallScore: string | null;
    study: {
        id: string; // projectWorkId
        workId: string;
        title: string;
        authors: string;
        year: number;
    };
    createdAt: string;
    updatedAt: string;
}

export interface SaveAssessmentParams {
    projectWorkId: string;
    toolId: string;
    domainScores: Record<string, {
        score: string;
        justification: string;
        answers?: Record<string, string>;
    }>;
    overallScore?: string;
    overallJustification?: string;
    complete: boolean;
    autoCalculateOverall?: boolean;
}

// Hooks
export function useQualityTools(projectId: string) {
    return useQuery({
        queryKey: ["quality-tools", projectId],
        queryFn: async () => {
            // api.get unwraps response data
            const data = await api.get<QualityTool[]>(`/api/projects/${projectId}/quality/tools`);
            return data;
        },
        enabled: !!projectId,
    });
}

export function useQualitySummary(projectId: string) {
    return useQuery({
        queryKey: ["quality-summary", projectId],
        queryFn: async () => {
            const data = await api.get<QualityAssessmentSummary>(
                `/api/projects/${projectId}/quality/assessments?summary=true`
            );
            return data;
        },
        enabled: !!projectId,
    });
}

export function useQualityAssessments(projectId: string, params?: { page?: number; limit?: number; status?: string; toolId?: string }) {
    return useQuery({
        queryKey: ["quality-assessments", projectId, params],
        queryFn: async () => {
            const searchParams = new URLSearchParams();
            if (params?.page) searchParams.set("page", params.page.toString());
            if (params?.limit) searchParams.set("limit", params.limit.toString());
            if (params?.status) searchParams.set("status", params.status);
            if (params?.toolId) searchParams.set("toolId", params.toolId);

            // Returns PaginatedResponse
            const data = await api.get<{ items: QualityAssessment[]; pagination: any }>(
                `/api/projects/${projectId}/quality/assessments?${searchParams.toString()}`
            );
            return data;
        },
        enabled: !!projectId,
    });
}

export function useQualityQueue(projectId: string) {
    return useQuery({
        queryKey: ["quality-queue", projectId],
        queryFn: async () => {
            const data = await api.get<any[]>(`/api/projects/${projectId}/quality/queue`);
            return data;
        },
        enabled: !!projectId,
    });
}

export function useSaveAssessment(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (params: SaveAssessmentParams) =>
            api.post(`/api/projects/${projectId}/quality/assessments`, params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["quality-assessments"] });
            queryClient.invalidateQueries({ queryKey: ["quality-summary"] });
            queryClient.invalidateQueries({ queryKey: ["quality-queue"] });
        },
    });
}
