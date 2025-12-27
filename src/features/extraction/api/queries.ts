import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface ExtractionItem {
    id: string; // ProjectWork ID
    study: {
        title: string;
        authors: string;
        year: number;
    };
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CONFLICT';
    qualityStatus: 'PENDING' | 'PASS' | 'FAIL' | 'FLAGGED';
    reviewers: string[];
}

export const extractionKeys = {
    all: ["extraction"] as const,
    queue: (projectId: string) => [...extractionKeys.all, "queue", projectId] as const,
    templates: (projectId: string) => [...extractionKeys.all, "templates", projectId] as const,
};

export const useExtractionQueue = (projectId: string) => {
    return useQuery({
        queryKey: extractionKeys.queue(projectId),
        queryFn: async () => {
            const data = await api.get<ExtractionItem[]>(`/api/projects/${projectId}/extraction/queue`);
            return data;
        },
        enabled: !!projectId,
    });
};

export const useExtractionTemplates = (projectId: string) => {
    return useQuery({
        queryKey: extractionKeys.templates(projectId),
        queryFn: async () => {
            // Using existing client type assumption - will return array of templates
            const data = await api.get<any[]>(`/api/projects/${projectId}/extraction/templates`);
            return data;
        },
        enabled: !!projectId,
    });
};

import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useCreateExtractionTemplate = (projectId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; description?: string; fields: any[] }) => {
            return api.post(`/api/projects/${projectId}/extraction/templates`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: extractionKeys.templates(projectId) });
        }
    });
};

export const useExtractionData = (projectId: string, projectWorkId: string) => {
    return useQuery({
        queryKey: [...extractionKeys.all, "data", projectWorkId],
        queryFn: async () => {
            // Return type should be ExtractionData possibly with template
            return api.get<any>(`/api/projects/${projectId}/extraction/data/${projectWorkId}`);
        },
        enabled: !!projectId && !!projectWorkId
    });
};

export const useSaveExtractionData = (projectId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { projectWorkId: string; templateId: string; data: any }) => {
            return api.post(`/api/projects/${projectId}/extraction/data`, data);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: [...extractionKeys.all, "data", variables.projectWorkId] });
            queryClient.invalidateQueries({ queryKey: extractionKeys.queue(projectId) }); // Update status in queue
        }
    });
};
