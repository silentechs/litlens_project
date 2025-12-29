/**
 * Domain Types for Screening Workflow
 * Pure business logic types, no framework dependencies
 */

import type { ScreeningPhase, ScreeningDecision, ProjectWorkStatus } from "@prisma/client";

// Re-export Prisma enums as domain types
export type { ScreeningPhase, ScreeningDecision, ProjectWorkStatus };

/**
 * Screening Configuration
 */
export interface ScreeningConfig {
  readonly requireDualScreening: boolean;
  readonly blindScreening: boolean;
  readonly reviewersNeeded: number; // Computed from requireDualScreening
}

/**
 * Decision Context - All info needed to process a screening decision
 */
export interface DecisionContext {
  readonly projectWorkId: string;
  readonly projectId: string;
  readonly workId: string;
  readonly phase: ScreeningPhase;
  readonly decision: ScreeningDecision;
  readonly config: ScreeningConfig;
  readonly existingDecisions: readonly DecisionRecord[];
  readonly source: DecisionSource;
}

export type DecisionSource = 
  | 'user_decision'
  | 'batch_operation'
  | 'conflict_resolution'
  | 'ai_suggestion'
  | 'manual_override';

/**
 * Decision Record - Immutable decision snapshot
 */
export interface DecisionRecord {
  readonly id: string;
  readonly reviewerId: string;
  readonly decision: ScreeningDecision;
  readonly reasoning?: string;
  readonly createdAt: Date;
}

/**
 * State Transition Result
 */
export interface StateTransitionResult {
  readonly newStatus: ProjectWorkStatus;
  readonly newPhase: ScreeningPhase;
  readonly finalDecision: ScreeningDecision | null;
  readonly conflictCreated: boolean;
  readonly shouldAdvancePhase: boolean;
  readonly shouldTriggerIngestion: boolean;
  readonly metadata: Record<string, unknown>;
}

/**
 * Conflict Data
 */
export interface ConflictData {
  readonly projectWorkId: string;
  readonly phase: ScreeningPhase;
  readonly decisions: readonly {
    readonly reviewerId: string;
    readonly decision: ScreeningDecision;
    readonly reasoning?: string;
  }[];
}

/**
 * Phase Transition Rules
 */
export const PHASE_TRANSITIONS: Record<ScreeningPhase, ScreeningPhase | null> = {
  TITLE_ABSTRACT: 'FULL_TEXT',
  FULL_TEXT: 'FINAL',
  FINAL: null,
} as const;

/**
 * Status for Decision Outcomes
 */
export const DECISION_STATUS_MAP: Record<ScreeningDecision, ProjectWorkStatus> = {
  INCLUDE: 'INCLUDED',
  EXCLUDE: 'EXCLUDED',
  MAYBE: 'MAYBE',
} as const;

