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
  status: string;
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
  constructor(private readonly deps: ScreeningServiceDeps) {}

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
    // Update project work status
    await this.deps.repository.updateProjectWorkStatus(projectWork.id, {
      status: result.newStatus,
      phase: result.newPhase,
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

    // Queue ingestion if needed
    if (result.shouldTriggerIngestion) {
      await this.deps.ingestionQueue.enqueueIngestion({
        projectWorkId: projectWork.id,
        workId: projectWork.workId,
        source: 'screening_decision',
      });
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
   * Resolve a conflict
   */
  async resolveConflict(input: {
    conflictId: string;
    resolverId: string;
    finalDecision: ScreeningDecision;
    reasoning?: string;
  }): Promise<StateTransitionResult> {
    // Implementation would:
    // 1. Load conflict
    // 2. Verify resolver permissions
    // 3. Create resolution record
    // 4. Re-run state machine with resolution as consensus
    // 5. Apply transition
    // 6. Publish events
    
    // Placeholder for clean implementation
    throw new Error('Not implemented yet - will use state machine for consistency');
  }
}

