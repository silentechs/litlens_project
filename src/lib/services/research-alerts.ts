/**
 * Research Alerts Service
 * Handles automated literature monitoring and notifications
 */

import { db } from "@/lib/db";
import { AlertType, AlertFrequency } from "@prisma/client";

// ============== TYPES ==============

export interface AlertConfig {
  name: string;
  description?: string;
  alertType: AlertType;
  searchQuery?: string;
  keywords: string[];
  authors: string[];
  journals: string[];
  frequency: AlertFrequency;
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  projectId?: string;
}

export interface AlertDiscoveryResult {
  workId: string | null;
  title: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
}

export interface AlertStats {
  totalAlerts: number;
  activeAlerts: number;
  totalDiscoveries: number;
  unreadDiscoveries: number;
  lastTriggered?: Date;
}

// ============== ALERT MANAGEMENT ==============

/**
 * Create a new research alert
 */
export async function createAlert(
  userId: string,
  config: AlertConfig
): Promise<{ id: string }> {
  const nextCheck = calculateNextCheck(config.frequency);

  const alert = await db.researchAlert.create({
    data: {
      userId,
      projectId: config.projectId,
      name: config.name,
      description: config.description,
      alertType: config.alertType,
      searchQuery: config.searchQuery,
      keywords: config.keywords,
      authors: config.authors,
      journals: config.journals,
      frequency: config.frequency,
      emailEnabled: config.emailEnabled ?? true,
      inAppEnabled: config.inAppEnabled ?? true,
      nextCheckAt: nextCheck,
    },
    select: { id: true },
  });

  return alert;
}

/**
 * Update an existing alert
 */
export async function updateAlert(
  alertId: string,
  userId: string,
  updates: Partial<AlertConfig> & { isActive?: boolean }
): Promise<void> {
  const alert = await db.researchAlert.findFirst({
    where: { id: alertId, userId },
  });

  if (!alert) {
    throw new Error("Alert not found");
  }

  const data: Record<string, unknown> = {};
  
  if (updates.name !== undefined) data.name = updates.name;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.searchQuery !== undefined) data.searchQuery = updates.searchQuery;
  if (updates.keywords !== undefined) data.keywords = updates.keywords;
  if (updates.authors !== undefined) data.authors = updates.authors;
  if (updates.journals !== undefined) data.journals = updates.journals;
  if (updates.frequency !== undefined) {
    data.frequency = updates.frequency;
    data.nextCheckAt = calculateNextCheck(updates.frequency);
  }
  if (updates.emailEnabled !== undefined) data.emailEnabled = updates.emailEnabled;
  if (updates.inAppEnabled !== undefined) data.inAppEnabled = updates.inAppEnabled;
  if (updates.isActive !== undefined) data.isActive = updates.isActive;

  await db.researchAlert.update({
    where: { id: alertId },
    data,
  });
}

/**
 * Delete an alert
 */
export async function deleteAlert(alertId: string, userId: string): Promise<void> {
  const alert = await db.researchAlert.findFirst({
    where: { id: alertId, userId },
  });

  if (!alert) {
    throw new Error("Alert not found");
  }

  await db.researchAlert.delete({ where: { id: alertId } });
}

/**
 * Get user's alerts
 */
export async function getUserAlerts(
  userId: string,
  options: { activeOnly?: boolean; projectId?: string } = {}
): Promise<Array<{
  id: string;
  name: string;
  description: string | null;
  alertType: AlertType;
  frequency: AlertFrequency;
  isActive: boolean;
  lastTriggeredAt: Date | null;
  discoveryCount: number;
  unreadCount: number;
}>> {
  const where: Record<string, unknown> = { userId };
  if (options.activeOnly) where.isActive = true;
  if (options.projectId) where.projectId = options.projectId;

  const alerts = await db.researchAlert.findMany({
    where,
    include: {
      _count: {
        select: { discoveries: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get unread counts separately
  const alertsWithCounts = await Promise.all(
    alerts.map(async (a) => {
      const unreadCount = await db.alertDiscovery.count({
        where: { alertId: a.id, isRead: false },
      });
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        alertType: a.alertType,
        frequency: a.frequency,
        isActive: a.isActive,
        lastTriggeredAt: a.lastTriggeredAt,
        discoveryCount: a._count.discoveries,
        unreadCount,
      };
    })
  );

  return alertsWithCounts;
}

/**
 * Get alert details with recent discoveries
 */
export async function getAlertDetails(
  alertId: string,
  userId: string
): Promise<{
  alert: {
    id: string;
    name: string;
    description: string | null;
    alertType: AlertType;
    searchQuery: string | null;
    keywords: string[];
    authors: string[];
    journals: string[];
    frequency: AlertFrequency;
    isActive: boolean;
    emailEnabled: boolean;
    inAppEnabled: boolean;
    lastTriggeredAt: Date | null;
    nextCheckAt: Date | null;
    createdAt: Date;
  };
  discoveries: AlertDiscoveryResult[];
} | null> {
  const alert = await db.researchAlert.findFirst({
    where: { id: alertId, userId },
  });

  if (!alert) return null;

  const discoveries = await db.alertDiscovery.findMany({
    where: { alertId },
    take: 50,
    orderBy: { discoveredAt: "desc" },
  });

  return {
    alert: {
      id: alert.id,
      name: alert.name,
      description: alert.description,
      alertType: alert.alertType,
      searchQuery: alert.searchQuery,
      keywords: alert.keywords,
      authors: alert.authors,
      journals: alert.journals,
      frequency: alert.frequency,
      isActive: alert.isActive,
      emailEnabled: alert.emailEnabled,
      inAppEnabled: alert.inAppEnabled,
      lastTriggeredAt: alert.lastTriggeredAt,
      nextCheckAt: alert.nextCheckAt,
      createdAt: alert.createdAt,
    },
    discoveries: discoveries.map((d) => ({
      workId: d.workId,
      title: d.title,
      metadata: d.metadata as Record<string, unknown>,
      isRead: d.isRead,
    })),
  };
}

// ============== ALERT PROCESSING ==============

/**
 * Process alerts that are due for checking
 * This would typically be called by a cron job
 */
export async function processAlertsDue(): Promise<{
  processed: number;
  discoveries: number;
}> {
  const now = new Date();

  // Get alerts due for processing
  const dueAlerts = await db.researchAlert.findMany({
    where: {
      isActive: true,
      nextCheckAt: { lte: now },
    },
  });

  let totalDiscoveries = 0;

  for (const alert of dueAlerts) {
    try {
      const discoveries = await checkAlertForNewWorks(alert);
      totalDiscoveries += discoveries.length;

      // Save discoveries
      if (discoveries.length > 0) {
        await db.alertDiscovery.createMany({
          data: discoveries.map((d) => ({
            alertId: alert.id,
            workId: d.workId,
            title: d.title,
            metadata: d.metadata as object,
          })),
          skipDuplicates: true,
        });
      }

      // Update alert
      await db.researchAlert.update({
        where: { id: alert.id },
        data: {
          lastTriggeredAt: now,
          nextCheckAt: calculateNextCheck(alert.frequency),
        },
      });
    } catch (error) {
      console.error(`Failed to process alert ${alert.id}:`, error);
    }
  }

  return {
    processed: dueAlerts.length,
    discoveries: totalDiscoveries,
  };
}

/**
 * Check an alert for new matching works
 */
async function checkAlertForNewWorks(
  alert: {
    id: string;
    searchQuery: string | null;
    keywords: string[];
    authors: string[];
    journals: string[];
    lastTriggeredAt: Date | null;
  }
): Promise<Array<{ workId: string; title: string; metadata: Record<string, unknown> }>> {
  const results: Array<{ workId: string; title: string; metadata: Record<string, unknown> }> = [];

  // Build search criteria
  const since = alert.lastTriggeredAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Search for new works matching criteria
  const conditions: Array<Record<string, unknown>> = [];

  // Keyword matching
  if (alert.keywords.length > 0) {
    conditions.push({
      OR: alert.keywords.map((kw) => ({
        OR: [
          { title: { contains: kw, mode: "insensitive" } },
          { abstract: { contains: kw, mode: "insensitive" } },
          { keywords: { has: kw } },
        ],
      })),
    });
  }

  // Journal matching
  if (alert.journals.length > 0) {
    conditions.push({
      journal: { in: alert.journals },
    });
  }

  if (conditions.length === 0) {
    return results;
  }

  const works = await db.work.findMany({
    where: {
      createdAt: { gte: since },
      AND: conditions,
    },
    select: { id: true, title: true },
    take: 100,
  });

  // Get existing discoveries to avoid duplicates
  const existingDiscoveries = await db.alertDiscovery.findMany({
    where: {
      alertId: alert.id,
      workId: { in: works.map((w) => w.id) },
    },
    select: { workId: true },
  });
  const existingIds = new Set(existingDiscoveries.map((d) => d.workId));

  works.forEach((work) => {
    if (!existingIds.has(work.id)) {
      // Calculate match reason
      const matchReasons: string[] = [];

      alert.keywords.forEach((kw) => {
        if (work.title.toLowerCase().includes(kw.toLowerCase())) {
          matchReasons.push(`Title contains "${kw}"`);
        }
      });

      results.push({
        workId: work.id,
        title: work.title,
        metadata: {
          matchReason: matchReasons.join("; ") || "Matching criteria",
          relevanceScore: Math.min(1, matchReasons.length * 0.3),
        },
      });
    }
  });

  return results;
}

/**
 * Mark discoveries as read
 */
export async function markDiscoveriesViewed(
  alertId: string,
  userId: string,
  discoveryIds?: string[]
): Promise<void> {
  // Verify ownership
  const alert = await db.researchAlert.findFirst({
    where: { id: alertId, userId },
  });

  if (!alert) {
    throw new Error("Alert not found");
  }

  const where: Record<string, unknown> = { alertId };
  if (discoveryIds && discoveryIds.length > 0) {
    where.id = { in: discoveryIds };
  }

  await db.alertDiscovery.updateMany({
    where,
    data: { isRead: true },
  });
}

/**
 * Get alert statistics for a user
 */
export async function getAlertStats(userId: string): Promise<AlertStats> {
  const alerts = await db.researchAlert.findMany({
    where: { userId },
    select: { id: true, isActive: true, lastTriggeredAt: true },
  });

  const alertIds = alerts.map((a) => a.id);

  const [totalDiscoveries, unreadDiscoveries] = await Promise.all([
    db.alertDiscovery.count({ where: { alertId: { in: alertIds } } }),
    db.alertDiscovery.count({ where: { alertId: { in: alertIds }, isRead: false } }),
  ]);

  const lastTriggered = alerts
    .map((a) => a.lastTriggeredAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    totalAlerts: alerts.length,
    activeAlerts: alerts.filter((a) => a.isActive).length,
    totalDiscoveries,
    unreadDiscoveries,
    lastTriggered,
  };
}

// ============== HELPERS ==============

function calculateNextCheck(frequency: AlertFrequency): Date {
  const now = new Date();
  
  switch (frequency) {
    case "DAILY":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "WEEKLY":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "HOURLY":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "REAL_TIME":
      return new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}
