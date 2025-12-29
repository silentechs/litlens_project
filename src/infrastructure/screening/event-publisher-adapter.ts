/**
 * Screening Event Publisher Adapter
 * 
 * Adapts domain events to infrastructure event system.
 * Currently wraps the existing event publisher and activity log.
 */

import { db } from '@/lib/db';
import { publishScreeningConflict } from '@/lib/events/publisher';
import type {
  ScreeningEventPublisher,
  DecisionMadeEvent,
  ConflictCreatedEvent,
  PhaseAdvancedEvent,
} from './screening-service';

export class ScreeningEventPublisherAdapter implements ScreeningEventPublisher {
  async publishDecisionMade(event: DecisionMadeEvent): Promise<void> {
    // Log activity
    await db.activity.create({
      data: {
        userId: event.reviewerId,
        projectId: event.projectId,
        type: 'SCREENING_DECISION',
        description: `Made ${event.decision} decision`,
        metadata: {
          projectWorkId: event.projectWorkId,
          phase: event.phase,
          decision: event.decision,
          newStatus: event.result.newStatus,
        },
      },
    });
  }

  async publishConflictCreated(event: ConflictCreatedEvent): Promise<void> {
    // Use existing real-time publisher
    const conflict = await db.conflict.findFirst({
      where: {
        projectWorkId: event.projectWorkId,
        phase: event.phase,
      },
      select: { id: true },
    });

    if (conflict) {
      publishScreeningConflict(
        event.projectId,
        conflict.id,
        event.projectWorkId
      );
    }
  }

  async publishPhaseAdvanced(event: PhaseAdvancedEvent): Promise<void> {
    // Log phase advancement (could trigger notifications)
    console.log(
      `[Phase Advanced] ${event.projectWorkId}: ${event.fromPhase} → ${event.toPhase}`
    );
    
    // Could add notification creation here
  }
}

