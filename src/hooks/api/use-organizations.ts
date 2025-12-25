/**
 * Organization Hooks
 * React Query hooks for organization management
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  organizationsApi,
  type Organization,
  type OrganizationMember,
} from "@/lib/api-client";

// ============== QUERY KEYS ==============

export const organizationKeys = {
  all: ["organizations"] as const,
  lists: () => [...organizationKeys.all, "list"] as const,
  details: () => [...organizationKeys.all, "detail"] as const,
  detail: (id: string) => [...organizationKeys.details(), id] as const,
  members: (id: string) => [...organizationKeys.detail(id), "members"] as const,
};

// ============== QUERIES ==============

/**
 * Fetch user's organizations
 */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.lists(),
    queryFn: () => organizationsApi.list(),
  });
}

/**
 * Fetch a single organization
 */
export function useOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.detail(orgId!),
    queryFn: () => organizationsApi.get(orgId!),
    enabled: !!orgId,
  });
}

/**
 * Fetch organization members
 */
export function useOrganizationMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.members(orgId!),
    queryFn: () => organizationsApi.getMembers(orgId!),
    enabled: !!orgId,
  });
}

// ============== MUTATIONS ==============

/**
 * Create an organization
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; slug?: string }) =>
      organizationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
    },
  });
}

/**
 * Update an organization
 */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, data }: { orgId: string; data: Partial<Organization> }) =>
      organizationsApi.update(orgId, data),
    onSuccess: (updatedOrg) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
      queryClient.setQueryData(organizationKeys.detail(updatedOrg.id), updatedOrg);
    },
  });
}

/**
 * Delete an organization
 */
export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orgId: string) => organizationsApi.delete(orgId),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
      queryClient.removeQueries({ queryKey: organizationKeys.detail(deletedId) });
    },
  });
}

/**
 * Add member to organization
 */
export function useAddOrganizationMember(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { userId: string; role: string }) =>
      organizationsApi.addMember(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(orgId) });
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(orgId) });
    },
  });
}

/**
 * Update member role
 */
export function useUpdateOrganizationMember(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { userId: string; role: string }) =>
      organizationsApi.updateMember(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(orgId) });
    },
  });
}

/**
 * Remove member from organization
 */
export function useRemoveOrganizationMember(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => organizationsApi.removeMember(orgId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(orgId) });
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(orgId) });
    },
  });
}

