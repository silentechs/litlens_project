/**
 * Project Domain Types
 */

import type {
  Project as PrismaProject,
  ProjectMember as PrismaProjectMember,
  ProjectStatus,
  ProjectRole,
} from "@prisma/client";

// ============== BASE TYPES (from Prisma) ==============

export type { ProjectStatus, ProjectRole } from "@prisma/client";

// ============== PROJECT TYPES ==============

export interface Project extends PrismaProject {
  _count?: ProjectCounts;
  highlightKeywords: string[];
  blindScreening: boolean;
  requireDualScreening: boolean;
}

export interface ProjectCounts {
  projectWorks: number;
  members: number;
  conflicts: number;
  importBatches: number;
}

export interface ProjectWithRelations extends Project {
  members: ProjectMemberWithUser[];
  protocol?: ProjectProtocol | null;
  _count: ProjectCounts;
}

export interface ProjectMember extends PrismaProjectMember { }

export interface ProjectMemberWithUser extends ProjectMember {
  user: ProjectUserSummary;
}

export interface ProjectUserSummary {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface ProjectProtocol {
  id: string;
  title: string;
  version: number;
  status: string;
  prosperoId: string | null;
}

// ============== PROJECT STATS ==============

export interface ProjectStats {
  totalStudies: number;
  pendingScreening: number;
  included: number;
  excluded: number;
  conflicts: number;
  extractionCompleted: number;
  qualityAssessed: number;
  progress: ProjectProgress;
  phaseTotals?: {
    titleAbstract: number;
    fullText: number;
    final: number;
  };
}

export interface ProjectProgress {
  screening: PhaseProgress;
  fullText: PhaseProgress;
  final: PhaseProgress;
  extraction: PhaseProgress;
  quality: PhaseProgress;
}

export interface PhaseProgress {
  total: number;
  completed: number;
  percentage: number;
}

// ============== PROJECT ACTIVITY ==============

export interface ProjectActivity {
  id: string;
  type: string;
  description: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

// ============== INPUT TYPES ==============

export interface CreateProjectInput {
  title: string;
  description?: string;
  population?: string;
  intervention?: string;
  comparison?: string;
  outcome?: string;
  isPublic?: boolean;
  blindScreening?: boolean;
  requireDualScreening?: boolean;
}

export interface UpdateProjectInput {
  title?: string;
  description?: string;
  population?: string;
  intervention?: string;
  comparison?: string;
  outcome?: string;
  status?: ProjectStatus;
  isPublic?: boolean;
  blindScreening?: boolean;
  requireDualScreening?: boolean;
}

export interface InviteMemberInput {
  email: string;
  role: ProjectRole;
  message?: string;
}

export interface UpdateMemberRoleInput {
  role: ProjectRole;
}

// ============== FILTER TYPES ==============

export interface ProjectFilters {
  status?: ProjectStatus | ProjectStatus[];
  search?: string;
  organizationId?: string;
  isArchived?: boolean;
}

// ============== LIST RESPONSE ==============

export interface ProjectListItem {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  _count: {
    projectWorks: number;
    members: number;
  };
  members: {
    user: ProjectUserSummary;
    role: ProjectRole;
  }[];
  progress: number; // 0-100
  lastActivity: string | null;
}

