/**
 * Screening State Machine - Pure Business Logic
 * 
 * Implements screening workflow rules without any infrastructure dependencies.
 * All transitions are deterministic and testable.
 * 
 * @principles
 * - Single Responsibility: Only handles state transitions
 * - Open/Closed: Extensible through strategy pattern
 * - Pure Functions: No side effects, easy to test
 */

import type {
  ScreeningPhase,
  ScreeningDecision,
  ProjectWorkStatus,
  DecisionContext,
  StateTransitionResult,
  DecisionRecord,
  ScreeningConfig,
} from './types';

import {
  PHASE_TRANSITIONS,
  DECISION_STATUS_MAP,
} from './types';

/**
 * Core state machine - determines next state based on decisions
 */
export class ScreeningStateMachine {
  /**
   * Calculate the next state after a decision is made
   * 
   * @pure - No side effects, deterministic output
   */
  static calculateNextState(context: DecisionContext): StateTransitionResult {
    const allDecisions = [...context.existingDecisions];
    const { config } = context;

    // Rule 1: Insufficient decisions - Still screening
    if (allDecisions.length < config.reviewersNeeded) {
      return this.createWaitingForReviewersResult(context);
    }

    // Rule 2: Check for conflicts (disagreement)
    const hasConflict = this.hasDecisionConflict(allDecisions, config);
    if (hasConflict) {
      return this.createConflictResult(context);
    }

    // Rule 3: Consensus reached - determine final state
    const consensusDecision = allDecisions[0].decision; // All agree
    return this.createConsensusResult(context, consensusDecision);
  }

  /**
   * Check if decisions conflict (require resolution)
   */
  private static hasDecisionConflict(
    decisions: readonly DecisionRecord[],
    config: ScreeningConfig
  ): boolean {
    // Single screening never has conflicts
    if (!config.requireDualScreening) {
      return false;
    }

    // Check if all decisions agree
    const uniqueDecisions = new Set(decisions.map(d => d.decision));
    return uniqueDecisions.size > 1;
  }

  /**
   * Create result for "waiting for more reviewers"
   */
  private static createWaitingForReviewersResult(
    context: DecisionContext
  ): StateTransitionResult {
    return {
      newStatus: 'SCREENING',
      newPhase: context.phase,
      finalDecision: null,
      conflictCreated: false,
      shouldAdvancePhase: false,
      shouldTriggerIngestion: false,
      metadata: {
        reason: 'waiting_for_reviewers',
        currentDecisions: context.existingDecisions.length,
        required: context.config.reviewersNeeded,
      },
    };
  }

  /**
   * Create result for conflict scenario
   */
  private static createConflictResult(
    context: DecisionContext
  ): StateTransitionResult {
    return {
      newStatus: 'CONFLICT',
      newPhase: context.phase,
      finalDecision: null,
      conflictCreated: true,
      shouldAdvancePhase: false,
      shouldTriggerIngestion: false,
      metadata: {
        reason: 'conflict_detected',
        decisions: context.existingDecisions.map(d => ({
          reviewerId: d.reviewerId,
          decision: d.decision,
        })),
      },
    };
  }

  /**
   * Create result for consensus scenario
   */
  private static createConsensusResult(
    context: DecisionContext,
    consensusDecision: ScreeningDecision
  ): StateTransitionResult {
    // Check if should auto-advance to next phase
    const shouldAdvance = this.shouldAutoAdvancePhase(
      context.phase,
      consensusDecision
    );

    const nextPhase = shouldAdvance
      ? PHASE_TRANSITIONS[context.phase]!
      : context.phase;

    const finalStatus = shouldAdvance
      ? 'PENDING' // Reset for next phase
      : DECISION_STATUS_MAP[consensusDecision];

    // Trigger ingestion only on final INCLUDE (not on phase advancement)
    const shouldIngest = consensusDecision === 'INCLUDE' && !shouldAdvance;

    return {
      newStatus: finalStatus,
      newPhase: nextPhase as ScreeningPhase,
      finalDecision: shouldAdvance ? null : consensusDecision,
      conflictCreated: false,
      shouldAdvancePhase: shouldAdvance,
      shouldTriggerIngestion: shouldIngest,
      metadata: {
        reason: 'consensus_reached',
        consensusDecision,
        autoAdvanced: shouldAdvance,
      },
    };
  }

  /**
   * Determine if a phase should auto-advance
   * 
   * Business Rule: INCLUDE at TITLE_ABSTRACT → auto-advance to FULL_TEXT
   * All other phases require manual advancement
   */
  private static shouldAutoAdvancePhase(
    currentPhase: ScreeningPhase,
    decision: ScreeningDecision
  ): boolean {
    return currentPhase === 'TITLE_ABSTRACT' && decision === 'INCLUDE';
  }

  /**
   * Validate phase transition (for manual advancement)
   */
  static validatePhaseAdvancement(params: {
    currentPhase: ScreeningPhase;
    pendingCount: number;
    unresolvedConflicts: number;
    screeningCount: number;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if next phase exists
    const nextPhase = PHASE_TRANSITIONS[params.currentPhase];
    if (!nextPhase) {
      errors.push('Cannot advance: already at final phase');
    }

    // Check for pending work
    if (params.pendingCount > 0) {
      errors.push(`Cannot advance: ${params.pendingCount} studies still pending`);
    }

    // Check for unresolved conflicts
    if (params.unresolvedConflicts > 0) {
      errors.push(
        `Cannot advance: ${params.unresolvedConflicts} unresolved conflicts`
      );
    }

    // Check for studies in screening
    if (params.screeningCount > 0) {
      errors.push(
        `Cannot advance: ${params.screeningCount} studies awaiting second reviewer`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate completion status for a phase
   */
  static calculatePhaseCompletion(params: {
    totalStudies: number;
    studiesWithRequiredDecisions: number;
    unresolvedConflicts: number;
  }): {
    complete: boolean;
    percentage: number;
    blockers: string[];
  } {
    const blockers: string[] = [];
    
    if (params.unresolvedConflicts > 0) {
      blockers.push(`${params.unresolvedConflicts} unresolved conflicts`);
    }

    const incomplete = params.totalStudies - params.studiesWithRequiredDecisions;
    if (incomplete > 0) {
      blockers.push(`${incomplete} studies need more reviews`);
    }

    const percentage = params.totalStudies > 0
      ? Math.round((params.studiesWithRequiredDecisions / params.totalStudies) * 100)
      : 100;

    return {
      complete: blockers.length === 0 && params.totalStudies > 0,
      percentage,
      blockers,
    };
  }
}

/**
 * Decision Validator - Validates business rules
 */
export class DecisionValidator {
  /**
   * Validate a decision can be made
   */
  static validate(params: {
    reviewerId: string;
    existingDecisions: readonly DecisionRecord[];
    config: ScreeningConfig;
  }): { valid: boolean; error?: string } {
    // Check if reviewer already decided
    const alreadyDecided = params.existingDecisions.some(
      d => d.reviewerId === params.reviewerId
    );

    if (alreadyDecided) {
      return {
        valid: false,
        error: 'You have already screened this study for this phase',
      };
    }

    // Check if already at max reviewers (shouldn't happen but guard)
    if (params.existingDecisions.length >= params.config.reviewersNeeded) {
      return {
        valid: false,
        error: 'This study has already received the required number of reviews',
      };
    }

    return { valid: true };
  }
}

