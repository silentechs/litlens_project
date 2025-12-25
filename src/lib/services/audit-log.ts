/**
 * Audit Log Service
 * Handles comprehensive audit logging for compliance and security
 */

import { db } from "@/lib/db";

// ============== TYPES ==============

export type AuditAction =
  // Organization actions
  | "org.created"
  | "org.updated"
  | "org.deleted"
  | "org.member_added"
  | "org.member_removed"
  | "org.member_role_changed"
  | "org.invitation_sent"
  | "org.invitation_accepted"
  // Project actions
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "project.member_added"
  | "project.member_removed"
  | "project.settings_changed"
  // Study actions
  | "study.imported"
  | "study.deleted"
  | "study.screened"
  | "study.extracted"
  | "study.assessed"
  // Security actions
  | "api_key.created"
  | "api_key.revoked"
  | "api_key.used"
  | "webhook.created"
  | "webhook.updated"
  | "webhook.deleted"
  // Auth actions
  | "auth.login"
  | "auth.logout"
  | "auth.password_changed"
  | "auth.mfa_enabled"
  | "auth.mfa_disabled"
  // Data actions
  | "data.exported"
  | "data.imported"
  | "data.bulk_deleted";

export type AuditResource =
  | "organization"
  | "project"
  | "user"
  | "work"
  | "screening"
  | "extraction"
  | "api_key"
  | "webhook"
  | "protocol";

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============== LOGGING ==============

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  organizationId: string,
  data: {
    action: AuditAction;
    resource: AuditResource;
    resourceId?: string;
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    context?: AuditContext;
  }
): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId,
      userId: data.context?.userId,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      oldValue: data.oldValue as object | undefined,
      newValue: data.newValue as object | undefined,
      ipAddress: data.context?.ipAddress,
      userAgent: data.context?.userAgent,
    },
  });
}

/**
 * Create audit log with diff tracking
 */
export async function createAuditLogWithDiff<T extends Record<string, unknown>>(
  organizationId: string,
  data: {
    action: AuditAction;
    resource: AuditResource;
    resourceId?: string;
    oldData?: T;
    newData?: T;
    fieldsToTrack?: (keyof T)[];
    context?: AuditContext;
  }
): Promise<void> {
  let oldValue: Record<string, unknown> | undefined;
  let newValue: Record<string, unknown> | undefined;

  if (data.oldData && data.newData && data.fieldsToTrack) {
    // Only include fields that changed
    oldValue = {};
    newValue = {};

    data.fieldsToTrack.forEach((field) => {
      const oldVal = data.oldData![field];
      const newVal = data.newData![field];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        oldValue![field as string] = oldVal;
        newValue![field as string] = newVal;
      }
    });

    // Skip logging if nothing changed
    if (Object.keys(oldValue).length === 0) {
      return;
    }
  } else {
    oldValue = data.oldData;
    newValue = data.newData;
  }

  await createAuditLog(organizationId, {
    action: data.action,
    resource: data.resource,
    resourceId: data.resourceId,
    oldValue,
    newValue,
    context: data.context,
  });
}

// ============== QUERYING ==============

/**
 * Get audit logs for an organization
 */
export async function getAuditLogs(
  organizationId: string,
  options: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: AuditAction;
    resource?: AuditResource;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId };

  if (options.userId) where.userId = options.userId;
  if (options.action) where.action = options.action;
  if (options.resource) where.resource = options.resource;
  if (options.resourceId) where.resourceId = options.resourceId;

  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      (where.createdAt as Record<string, unknown>).gte = options.startDate;
    }
    if (options.endDate) {
      (where.createdAt as Record<string, unknown>).lte = options.endDate;
    }
  }

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Get user info for logs that have userId
  const userIds = [...new Set(logs.filter((l) => l.userId).map((l) => l.userId!))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return {
    logs: logs.map((l) => ({
      id: l.id,
      organizationId: l.organizationId,
      userId: l.userId,
      action: l.action,
      resource: l.resource,
      resourceId: l.resourceId,
      oldValue: l.oldValue as Record<string, unknown> | null,
      newValue: l.newValue as Record<string, unknown> | null,
      ipAddress: l.ipAddress,
      userAgent: l.userAgent,
      createdAt: l.createdAt,
      user: l.userId ? userMap[l.userId] : undefined,
    })),
    total,
  };
}

/**
 * Get audit log summary statistics
 */
export async function getAuditStats(
  organizationId: string,
  days = 30
): Promise<{
  totalActions: number;
  actionsByType: Record<string, number>;
  actionsByResource: Record<string, number>;
  actionsByUser: Array<{ userId: string; userName: string | null; count: number }>;
  actionsByDay: Array<{ date: string; count: number }>;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await db.auditLog.findMany({
    where: {
      organizationId,
      createdAt: { gte: since },
    },
    select: {
      action: true,
      resource: true,
      userId: true,
      createdAt: true,
    },
  });

  // Count by action type
  const actionsByType: Record<string, number> = {};
  logs.forEach((l) => {
    actionsByType[l.action] = (actionsByType[l.action] || 0) + 1;
  });

  // Count by resource
  const actionsByResource: Record<string, number> = {};
  logs.forEach((l) => {
    actionsByResource[l.resource] = (actionsByResource[l.resource] || 0) + 1;
  });

  // Count by user
  const userCounts: Record<string, number> = {};
  logs.forEach((l) => {
    if (l.userId) {
      userCounts[l.userId] = (userCounts[l.userId] || 0) + 1;
    }
  });

  // Get user names
  const userIds = Object.keys(userCounts);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const actionsByUser = Object.entries(userCounts)
    .map(([userId, count]) => ({
      userId,
      userName: userMap[userId] || null,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Count by day
  const dayMap: Record<string, number> = {};
  logs.forEach((l) => {
    const date = l.createdAt.toISOString().split("T")[0];
    dayMap[date] = (dayMap[date] || 0) + 1;
  });

  const actionsByDay = Object.entries(dayMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalActions: logs.length,
    actionsByType,
    actionsByResource,
    actionsByUser,
    actionsByDay,
  };
}

/**
 * Search audit logs by content
 */
export async function searchAuditLogs(
  organizationId: string,
  searchTerm: string,
  options: { page?: number; limit?: number } = {}
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  // This is a basic implementation - in production, you might want full-text search
  const page = options.page || 1;
  const limit = options.limit || 50;
  const skip = (page - 1) * limit;

  // Search in action and resource fields
  const where = {
    organizationId,
    OR: [
      { action: { contains: searchTerm, mode: "insensitive" as const } },
      { resource: { contains: searchTerm, mode: "insensitive" as const } },
      { resourceId: { contains: searchTerm, mode: "insensitive" as const } },
    ],
  };

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l.id,
      organizationId: l.organizationId,
      userId: l.userId,
      action: l.action,
      resource: l.resource,
      resourceId: l.resourceId,
      oldValue: l.oldValue as Record<string, unknown> | null,
      newValue: l.newValue as Record<string, unknown> | null,
      ipAddress: l.ipAddress,
      userAgent: l.userAgent,
      createdAt: l.createdAt,
    })),
    total,
  };
}

// ============== RETENTION ==============

/**
 * Delete old audit logs (for data retention policies)
 */
export async function purgeOldAuditLogs(
  organizationId: string,
  retentionDays: number
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await db.auditLog.deleteMany({
    where: {
      organizationId,
      createdAt: { lt: cutoff },
    },
  });

  return result.count;
}

/**
 * Export audit logs (for compliance)
 */
export async function exportAuditLogs(
  organizationId: string,
  options: {
    startDate: Date;
    endDate: Date;
    format?: "json" | "csv";
  }
): Promise<string> {
  const logs = await db.auditLog.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: options.startDate,
        lte: options.endDate,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (options.format === "csv") {
    const headers = [
      "id",
      "timestamp",
      "user_id",
      "action",
      "resource",
      "resource_id",
      "ip_address",
      "user_agent",
    ];

    const rows = logs.map((l) =>
      [
        l.id,
        l.createdAt.toISOString(),
        l.userId || "",
        l.action,
        l.resource,
        l.resourceId || "",
        l.ipAddress || "",
        (l.userAgent || "").replace(/,/g, ";"),
      ].join(",")
    );

    return [headers.join(","), ...rows].join("\n");
  }

  return JSON.stringify(
    logs.map((l) => ({
      id: l.id,
      timestamp: l.createdAt.toISOString(),
      userId: l.userId,
      action: l.action,
      resource: l.resource,
      resourceId: l.resourceId,
      oldValue: l.oldValue,
      newValue: l.newValue,
      ipAddress: l.ipAddress,
      userAgent: l.userAgent,
    })),
    null,
    2
  );
}

