"use client";

import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { ProjectRole } from "@/types/project";

interface AddMemberInput {
    email: string;
    role: ProjectRole;
}

interface UpdateMemberInput {
    memberId: string;
    role: ProjectRole;
}

interface RemoveMemberInput {
    memberId: string;
}


export interface TeamMember {
    id: string;
    userId: string;
    role: 'OWNER' | 'LEAD' | 'REVIEWER' | 'OBSERVER';
    joinedAt: string;
    user: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
        institution: string | null;
    };
    stats: {
        total: number;
        included: number;
        excluded: number;
        maybe: number;
    };
}

export interface MembersResponse {
    members: TeamMember[];
    total: number;
}
async function addMember(projectId: string, input: AddMemberInput) {
    const response = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to add member");
    }

    return response.json();
}

async function updateMemberRole(projectId: string, input: UpdateMemberInput) {
    const response = await fetch(`/api/projects/${projectId}/members/${input.memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: input.role }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to update member role");
    }

    return response.json();
}

async function removeMember(projectId: string, input: RemoveMemberInput) {
    const response = await fetch(`/api/projects/${projectId}/members/${input.memberId}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to remove member");
    }
}

export function useAddMember(projectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: AddMemberInput) => addMember(projectId, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
            queryClient.invalidateQueries({ queryKey: ["projects", "detail", projectId] });
        },
    });
}

export function useUpdateMemberRole(projectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: UpdateMemberInput) => updateMemberRole(projectId, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
        },
    });
}

export function useRemoveMember(projectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: RemoveMemberInput) => removeMember(projectId, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
            queryClient.invalidateQueries({ queryKey: ["projects", "detail", projectId] });
        },
    });
}

export function useProjectMembers(projectId: string) {
    return useQuery<MembersResponse>({
        queryKey: ["project-members", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/members`);
            if (!res.ok) throw new Error("Failed to fetch team members");
            return res.json();
        },
        enabled: !!projectId,
    });
}
