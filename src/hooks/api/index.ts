/**
 * API Hooks Index
 * Re-export all API hooks
 */

// Projects
export {
  projectKeys,
  useProjects,
  useProject,
  useProjectStats,
  useProjectMembers,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useAddProjectMember,
  useUpdateProjectMember,
  useRemoveProjectMember,
} from "./use-projects";

// Screening
export {
  screeningKeys,
  useScreeningQueue,
  useInfiniteScreeningQueue,
  useScreeningProgress,
  useAiSuggestion,
  useSubmitDecision,
  useBatchDecision,
  useConflicts,
  useConflict,
  useResolveConflict,
} from "./use-screening";

// Library
export {
  libraryKeys,
  useLibraryItems,
  useLibraryFolders,
  useAddToLibrary,
  useUpdateLibraryItem,
  useRemoveFromLibrary,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useUpdateReadingStatus,
  useUpdateRating,
} from "./use-library";

// Organizations
export {
  organizationKeys,
  useOrganizations,
  useOrganization,
  useOrganizationMembers,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  useAddOrganizationMember,
  useUpdateOrganizationMember,
  useRemoveOrganizationMember,
} from "./use-organizations";

