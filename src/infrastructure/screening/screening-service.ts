/**
 * Screening Service (Infrastructure Layer)
 * 
 * Orchestrates screening workflow using domain state machine.
 * Handles persistence, events, and side effects.
 * 
 * @principles
 * - Dependency Injection: All dependencies injected
 * - Single Responsibility: Orchestrates screening workflow
 * - Open/Closed: Extensible through event system
 */

import type { Prisma } from '@prisma/client';
import type {
  DecisionContext,
  StateTransitionResult,
  DecisionRecord,
  ScreeningConfig,
  ScreeningPhase,
  ScreeningDecision,
  ConflictData,
} from '@/domain/screening/types';

import { ScreeningStateMachine, DecisionValidator } from '@/domain/screening/state-machine';

/**
 * Repository Interfaces (Infrastructure abstraction)
 */
export interface ScreeningRepository {
  getProjectWork(id: string): Promise<ProjectWorkData | null>;
  getDecisions(projectWorkId: string, phase: ScreeningPhase): Promise<DecisionRecord[]>;
  createDecision(data: CreateDecisionData): Promise<void>;
  updateProjectWorkStatus(id: string, update: ProjectWorkUpdate): Promise<void>;
  upsertConflict(conflict: ConflictData & { projectId: string }): Promise<void>;
  getProjectConfig(projectId: string): Promise<ScreeningConfig>;

  // ✅ CLEAN ARCHITECTURE FIX: Conflict methods added to interface
  getConflict(conflictId: string): Promise<ConflictRecord | null>;
  createConflictResolution(data: {
    conflictId: string;
    resolverId: string;
    finalDecision: ScreeningDecision;
    reasoning?: string;
  }): Promise<void>;
}

/**
 * Conflict record type
 */
export interface ConflictRecord {
  id: string;
  projectId: string;
  projectWorkId: string;
  phase: ScreeningPhase;
  status: string;
  decisions: any;
}

/**
 * Event Publisher Interface
 */
export interface ScreeningEventPublisher {
  publishDecisionMade(event: DecisionMadeEvent): Promise<void>;
  publishConflictCreated(event: ConflictCreatedEvent): Promise<void>;
  publishPhaseAdvanced(event: PhaseAdvancedEvent): Promise<void>;
}

/**
 * Ingestion Queue Interface
 */
export interface IngestionQueue {
  enqueueIngestion(job: {
    projectWorkId: string;
    workId: string;
    source: string;
  }): Promise<void>;
}

/**
 * Data Types
 */
export interface ProjectWorkData {
  id: string;
  projectId: string;
  workId: string;
  phase: ScreeningPhase;
  // ✅ Fields for S1/S3 checks
  pdfR2Key?: string | null;
  url?: string | null;
  ingestionStatus?: string | null;
}

export interface CreateDecisionData {
  projectWorkId: string;
  reviewerId: string;
  phase: ScreeningPhase;
  decision: ScreeningDecision;
  reasoning?: string;
  exclusionReason?: string;
  timeSpentMs?: number;
  confidence?: number;
  followedAi?: boolean;
}

export interface ProjectWorkUpdate {
  status: "PENDING" | "SCREENING" | "CONFLICT" | "INCLUDED" | "EXCLUDED" | "MAYBE";
  phase?: ScreeningPhase;
  finalDecision?: ScreeningDecision | null;
}

/**
 * Event Types
 */
export interface DecisionMadeEvent {
  projectWorkId: string;
  projectId: string;
  reviewerId: string;
  phase: ScreeningPhase;
  decision: ScreeningDecision;
  result: StateTransitionResult;
}

export interface ConflictCreatedEvent {
  projectWorkId: string;
  projectId: string;
  phase: ScreeningPhase;
  decisions: readonly { reviewerId: string; decision: ScreeningDecision }[];
}

export interface PhaseAdvancedEvent {
  projectWorkId: string;
  fromPhase: ScreeningPhase;
  toPhase: ScreeningPhase;
  triggeredBy: 'auto' | 'manual' | 'conflict_resolution';
}

/**
 * Screening Service Dependencies
 */
export interface ScreeningServiceDeps {
  readonly repository: ScreeningRepository;
  readonly eventPublisher: ScreeningEventPublisher;
  readonly ingestionQueue: IngestionQueue;
}

/**
 * Main Screening Service
 */
export class ScreeningService {
  constructor(private readonly deps: ScreeningServiceDeps) { }

  /**
   * Process a screening decision (main workflow)
   */
  async processDecision(input: {
    projectWorkId: string;
    reviewerId: string;
    phase: ScreeningPhase;
    decision: ScreeningDecision;
    reasoning?: string;
    exclusionReason?: string;
    timeSpentMs?: number;
    confidence?: number;
    followedAi?: boolean;
  }): Promise<StateTransitionResult> {
    // 1. Load necessary data
    const projectWork = await this.deps.repository.getProjectWork(input.projectWorkId);
    if (!projectWork) {
      throw new Error('ProjectWork not found');
    }

    const config = await this.deps.repository.getProjectConfig(projectWork.projectId);
    const existingDecisions = await this.deps.repository.getDecisions(
      input.projectWorkId,
      input.phase
    );

    // 2. Validate decision
    const validation = DecisionValidator.validate({
      reviewerId: input.reviewerId,
      existingDecisions,
      config,
    });

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 3. Store decision
    await this.deps.repository.createDecision({
      projectWorkId: input.projectWorkId,
      reviewerId: input.reviewerId,
      phase: input.phase,
      decision: input.decision,
      reasoning: input.reasoning,
      exclusionReason: input.exclusionReason,
      timeSpentMs: input.timeSpentMs,
      confidence: input.confidence,
      followedAi: input.followedAi,
    });

    // 4. Calculate next state using domain logic
    const updatedDecisions: DecisionRecord[] = [
      ...existingDecisions,
      {
        id: 'new', // Will be assigned by DB
        reviewerId: input.reviewerId,
        decision: input.decision,
        reasoning: input.reasoning,
        createdAt: new Date(),
      },
    ];

    const context: DecisionContext = {
      projectWorkId: input.projectWorkId,
      projectId: projectWork.projectId,
      workId: projectWork.workId,
      phase: input.phase,
      decision: input.decision,
      config,
      existingDecisions: updatedDecisions,
      source: 'user_decision',
    };

    const result = ScreeningStateMachine.calculateNextState(context);

    // 5. Apply state changes
    await this.applyStateTransition(projectWork, result, updatedDecisions);

    // 6. Publish events
    await this.publishEvents(projectWork, input, result, updatedDecisions);

    return result;
  }

  /**
   * Apply state transition to database
   */
  private async applyStateTransition(
    projectWork: ProjectWorkData,
    result: StateTransitionResult,
    decisions: readonly DecisionRecord[]
  ): Promise<void> {

    // ✅ S1 FIX: Safe Auto-Advance
    // If attempting to auto-advance to FULL_TEXT, verify PDF availability
    let finalPhase = result.newPhase;
    let finalStatus = result.newStatus;

    if (result.shouldAdvancePhase && result.newPhase === 'FULL_TEXT') {
      const hasPdf = !!projectWork.pdfR2Key || !!projectWork.url; // Basic check (URL might not be a PDF but it's a source)
      // Ideally we check if we have the PDF explicitly:
      const pdfAvailable = !!projectWork.pdfR2Key;

      if (!pdfAvailable) {
        console.warn(`[Screening] Preventing auto-advance for ${projectWork.id}: No PDF available`);
        finalPhase = projectWork.phase; // Stay in current phase (TITLE_ABSTRACT)
        finalStatus = 'PENDING'; // Or stay pending for PDF?
        // Note: If we stay in TITLE_ABSTRACT but decisions are made (CONSENSUS: INCLUDE), 
        // the state machine thinks we are done.
        // If we mark as PENDING, it might re-enter queue?
        // But 'decisions' exist.
        // Actually, if we set status=PENDING, queue filters exclude studies where user has decided.
        // So reviewiers won't see it.
        // Admins will see it as PENDING.
        // We should ideally trigger PDF fetch here if missing.
        await this.deps.ingestionQueue.enqueueIngestion({
          projectWorkId: projectWork.id,
          workId: projectWork.workId,
          source: 'missing_pdf_autoadvance',
        });
      }
    }

    // Update project work status
    await this.deps.repository.updateProjectWorkStatus(projectWork.id, {
      status: finalStatus,
      phase: finalPhase,
      finalDecision: result.finalDecision,
    });

    // Create conflict if needed
    if (result.conflictCreated) {
      await this.deps.repository.upsertConflict({
        projectId: projectWork.projectId,
        projectWorkId: projectWork.id,
        phase: projectWork.phase,
        decisions: decisions.map(d => ({
          reviewerId: d.reviewerId,
          decision: d.decision,
          reasoning: d.reasoning,
        })),
      });
    }

    // ✅ S3 FIX: Smart Ingestion Trigger
    // Queue ingestion if needed, but prevent duplicates
    if (result.shouldTriggerIngestion) {
      const isProcessing = projectWork.ingestionStatus === 'PROCESSING' || projectWork.ingestionStatus === 'COMPLETED';
      if (!isProcessing) {
        // Check if we have source
        if (projectWork.pdfR2Key || projectWork.url) {
          await this.deps.ingestionQueue.enqueueIngestion({
            projectWorkId: projectWork.id,
            workId: projectWork.workId,
            source: 'screening_decision',
          });
        } else {
          console.warn(`[Screening] Cannot queue ingestion for ${projectWork.id}: No source available`);
        }
      }
    }
  }

  /**
   * Publish domain events
   */
  private async publishEvents(
    projectWork: ProjectWorkData,
    input: {
      reviewerId: string;
      phase: ScreeningPhase;
      decision: ScreeningDecision;
    },
    result: StateTransitionResult,
    decisions: readonly DecisionRecord[]
  ): Promise<void> {
    // Always publish decision made
    await this.deps.eventPublisher.publishDecisionMade({
      projectWorkId: projectWork.id,
      projectId: projectWork.projectId,
      reviewerId: input.reviewerId,
      phase: input.phase,
      decision: input.decision,
      result,
    });

    // Publish conflict created
    if (result.conflictCreated) {
      await this.deps.eventPublisher.publishConflictCreated({
        projectWorkId: projectWork.id,
        projectId: projectWork.projectId,
        phase: input.phase,
        decisions: decisions.map(d => ({
          reviewerId: d.reviewerId,
          decision: d.decision,
        })),
      });
    }

    // Publish phase advanced
    if (result.shouldAdvancePhase) {
      await this.deps.eventPublisher.publishPhaseAdvanced({
        projectWorkId: projectWork.id,
        fromPhase: projectWork.phase,
        toPhase: result.newPhase,
        triggeredBy: 'auto',
      });
    }
  }

  /**
   * ✅ S3 FIX: Full conflict resolution implementation
   * Resolves a screening conflict by applying a final decision
   */
  async resolveConflict(input: {
    conflictId: string;
    resolverId: string;
    finalDecision: ScreeningDecision;
    reasoning?: string;
  }): Promise<StateTransitionResult> {
    // 1. ✅ CLEAN ARCHITECTURE FIX: Use repository instead of direct DB access
    const conflict = await this.deps.repository.getConflict(input.conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    if (conflict.status === 'RESOLVED') {
      throw new Error('Conflict has already been resolved');
    }

    // 2. Get project work data
    const projectWork = await this.deps.repository.getProjectWork(conflict.projectWorkId);
    if (!projectWork) {
      throw new Error('ProjectWork not found for conflict');
    }

    // 3. ✅ CLEAN ARCHITECTURE FIX: Use repository instead of direct DB access
    await this.deps.repository.createConflictResolution({
      conflictId: input.conflictId,
      resolverId: input.resolverId,
      finalDecision: input.finalDecision,
      reasoning: input.reasoning,
    });

    // 4. Determine new status based on resolved decision
    const newStatus = this.mapDecisionToStatus(input.finalDecision);

    // 5. Check if should advance phase (only for INCLUDE at TITLE_ABSTRACT)
    const shouldAdvance = conflict.phase === 'TITLE_ABSTRACT' && input.finalDecision === 'INCLUDE';
    const nextPhase = shouldAdvance ? 'FULL_TEXT' : conflict.phase;

    // 6. Update project work status
    await this.deps.repository.updateProjectWorkStatus(conflict.projectWorkId, {
      status: shouldAdvance ? 'PENDING' : newStatus,
      phase: nextPhase as ScreeningPhase,
      finalDecision: shouldAdvance ? null : input.finalDecision,
    });

    // 7. Trigger ingestion if final INCLUDE at FULL_TEXT or later (not advancing)
    const isFullTextOrLater = conflict.phase === 'FULL_TEXT' || conflict.phase === 'FINAL';
    const shouldIngest = input.finalDecision === 'INCLUDE' && isFullTextOrLater && !shouldAdvance;
    if (shouldIngest) {
      await this.deps.ingestionQueue.enqueueIngestion({
        projectWorkId: conflict.projectWorkId,
        workId: projectWork.workId,
        source: 'conflict_resolution',
      });
    }

    // 8. Build result for caller
    const result: StateTransitionResult = {
      newStatus: shouldAdvance ? 'PENDING' : newStatus,
      newPhase: nextPhase as ScreeningPhase,
      finalDecision: shouldAdvance ? null : input.finalDecision,
      conflictCreated: false,
      shouldAdvancePhase: shouldAdvance,
      shouldTriggerIngestion: shouldIngest,
      metadata: {
        reason: 'conflict_resolved',
        resolverId: input.resolverId,
        conflictId: input.conflictId,
      },
    };

    // 9. Publish events
    if (shouldAdvance) {
      await this.deps.eventPublisher.publishPhaseAdvanced({
        projectWorkId: conflict.projectWorkId,
        fromPhase: conflict.phase,
        toPhase: nextPhase as ScreeningPhase,
        triggeredBy: 'conflict_resolution',
      });
    }

    return result;
  }

  /**
   * Helper: Map decision to project work status
   */
  private mapDecisionToStatus(decision: ScreeningDecision): ProjectWorkUpdate['status'] {
    switch (decision) {
      case 'INCLUDE': return 'INCLUDED';
      case 'EXCLUDE': return 'EXCLUDED';
      case 'MAYBE': return 'MAYBE';
    }
  }
}
