/**
 * Screening Domain Types
 */

import type {
  ScreeningPhase,
  ScreeningDecision,
  ProjectWorkStatus,
  ConflictStatus,
} from "@prisma/client";

// Re-export Prisma enums
export type { ScreeningPhase, ScreeningDecision, ProjectWorkStatus, ConflictStatus } from "@prisma/client";

// ============== SCREENING QUEUE TYPES ==============

export interface ScreeningQueueItem {
  id: string; // ProjectWork ID
  workId: string;
  status: ProjectWorkStatus;
  phase: ScreeningPhase;

  // Work details
  title: string;
  authors: WorkAuthor[];
  abstract: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  url?: string | null;

  // AI assistance
  aiSuggestion?: ScreeningDecision | null;
  aiConfidence?: number | null;
  aiReasoning?: string | null;

  // User's previous decision (if any)
  userDecision?: ScreeningDecision | null;

  // Metadata
  importSource: string | null;
  createdAt: string;

  // Full-text / ingestion status (for Evidence Chat)
  pdfR2Key?: string | null;
  pdfUploadedAt?: string | null;
  pdfFileSize?: number | null;
  pdfSource?: string | null;
  ingestionStatus?: string | null; // PENDING/PROCESSING/COMPLETED/FAILED/...
  ingestionError?: string | null;
  chunksCreated?: number | null;
  lastIngestedAt?: string | null;

  // Dual screening status
  reviewerStatus?: "FIRST_REVIEWER" | "SECOND_REVIEWER" | "AWAITING_OTHER" | "COMPLETED";
  votedReviewers?: Array<{
    id: string;
    name: string | null;
    image: string | null;
    votedAt: string;
  }>;
  totalReviewersNeeded?: number;
  reviewersVoted?: number;

  // Tags
  tags?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

export interface WorkAuthor {
  name: string;
  orcid?: string | null;
  affiliation?: string | null;
}

// ============== SCREENING DECISION TYPES ==============

export interface ScreeningDecisionInput {
  projectWorkId: string;
  phase: ScreeningPhase;
  decision: ScreeningDecision;
  reasoning?: string;
  exclusionReason?: string;
  confidence?: number;
  timeSpentMs?: number;
  followedAi?: boolean;
}

export interface ScreeningDecisionRecord {
  id: string;
  projectWorkId: string;
  reviewerId: string;
  phase: ScreeningPhase;
  decision: ScreeningDecision;
  reasoning: string | null;
  exclusionReason: string | null;
  confidence: number | null;
  aiSuggestion: ScreeningDecision | null;
  aiConfidence: number | null;
  followedAi: boolean | null;
  timeSpentMs: number | null;
  createdAt: string;
  reviewer?: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

// ============== CONFLICT TYPES ==============

export interface Conflict {
  id: string;
  projectId: string;
  projectWorkId: string;
  phase: ScreeningPhase;
  status: ConflictStatus;
  decisions: ConflictDecision[];
  createdAt: string;
  resolvedAt: string | null;

  // Related work info
  work: {
    title: string;
    authors: WorkAuthor[];
    year: number | null;
  };
}

export interface ConflictDecision {
  reviewerId: string;
  reviewerName: string | null;
  reviewerImage: string | null;
  decision: ScreeningDecision;
  reasoning: string | null;
}

export interface ConflictResolutionInput {
  finalDecision: ScreeningDecision;
  reasoning?: string;
}

export interface ConflictResolution {
  id: string;
  conflictId: string;
  resolverId: string;
  finalDecision: ScreeningDecision;
  reasoning: string | null;
  createdAt: string;
  resolver: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

// ============== SCREENING STATS ==============

export interface ScreeningStats {
  phase: ScreeningPhase;
  total: number;
  pending: number;
  screened: number;
  included: number;
  excluded: number;
  maybe: number;
  conflicts: number;
  progress: number; // 0-100
}

export interface ReviewerStats {
  reviewerId: string;
  reviewerName: string | null;
  totalDecisions: number;
  includeCount: number;
  excludeCount: number;
  maybeCount: number;
  averageTimeMs: number;
  aiAgreementRate: number;
}

// ============== AI SCREENING ==============

export interface AIScreeningRequest {
  projectWorkIds: string[];
  phase: ScreeningPhase;
}

export interface AIScreeningResult {
  projectWorkId: string;
  suggestion: ScreeningDecision;
  confidence: number;
  reasoning: string;
  keyFactors: string[];
}

// ============== BATCH OPERATIONS ==============

export interface BatchScreeningInput {
  projectWorkIds: string[];
  phase: ScreeningPhase;
  decision: ScreeningDecision;
  reasoning?: string;
}

export interface BatchScreeningResult {
  processed: number;
  failed: number;
  errors: { projectWorkId: string; error: string }[];
}

// ============== FILTERS ==============

export interface ScreeningQueueFilters {
  phase?: ScreeningPhase;
  status?: ProjectWorkStatus;
  search?: string;
  hasAiSuggestion?: boolean;
  aiSuggestion?: ScreeningDecision;
  sortBy?: "title" | "year" | "aiConfidence" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface ScreeningNextSteps {
  completed: boolean;
  totalPending: number; // For the user
  conflicts: number;
  remainingReviewers: number; // Number of studies still awaiting additional reviews (team-level blocker)
  phaseStats: {
    total: number;
    included: number;
    excluded: number;
    maybe: number;
  };
  canMoveToNextPhase: boolean;
  nextPhase?: ScreeningPhase;
}
