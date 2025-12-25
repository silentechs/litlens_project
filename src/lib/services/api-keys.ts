/**
 * API Keys Service
 * Handles API key generation, validation, and rate limiting
 */

import { db } from "@/lib/db";
import { createHash, randomBytes } from "crypto";

// ============== TYPES ==============

export interface ApiKeyPermission {
  resource: string; // e.g., "projects", "works", "screening"
  actions: string[]; // e.g., ["read", "write", "delete"]
}

export interface ApiKeyData {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: ApiKeyPermission[];
  rateLimit: number;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  usageCount?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// ============== KEY GENERATION ==============

/**
 * Generate a new API key
 * Returns the plaintext key (only shown once) and the key data
 */
export async function generateApiKey(
  organizationId: string,
  data: {
    name: string;
    permissions?: ApiKeyPermission[];
    rateLimit?: number;
    expiresAt?: Date;
  }
): Promise<{ key: string; keyData: ApiKeyData }> {
  // Generate a secure random key
  const rawKey = randomBytes(32).toString("hex"); // 64 characters
  const keyPrefix = rawKey.substring(0, 8);
  const keyHash = hashApiKey(rawKey);

  const apiKey = await db.apiKey.create({
    data: {
      organizationId,
      name: data.name,
      keyHash,
      keyPrefix,
      permissions: (data.permissions || []) as unknown as object[],
      rateLimit: data.rateLimit || 1000,
      expiresAt: data.expiresAt,
    },
  });

  return {
    key: `litlens_${rawKey}`, // Prefix for easy identification
    keyData: {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      permissions: (apiKey.permissions as unknown as ApiKeyPermission[]) || [],
      rateLimit: apiKey.rateLimit,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
    },
  };
}

/**
 * Hash an API key for storage
 */
export function hashApiKey(key: string): string {
  // Remove prefix if present
  const rawKey = key.startsWith("litlens_") ? key.substring(8) : key;
  return createHash("sha256").update(rawKey).digest("hex");
}

// ============== KEY VALIDATION ==============

/**
 * Validate an API key and return its data
 */
export async function validateApiKey(
  key: string
): Promise<{
  valid: boolean;
  apiKey?: ApiKeyData;
  organizationId?: string;
  error?: string;
}> {
  if (!key || !key.startsWith("litlens_")) {
    return { valid: false, error: "Invalid key format" };
  }

  const keyHash = hashApiKey(key);

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: {
      organization: {
        select: { id: true, name: true, tier: true },
      },
    },
  });

  if (!apiKey) {
    return { valid: false, error: "Invalid API key" };
  }

  if (!apiKey.isActive) {
    return { valid: false, error: "API key is disabled" };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, error: "API key has expired" };
  }

  // Update last used timestamp
  await db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    valid: true,
    apiKey: {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      permissions: (apiKey.permissions as unknown as ApiKeyPermission[]) || [],
      rateLimit: apiKey.rateLimit,
      lastUsedAt: new Date(),
      expiresAt: apiKey.expiresAt,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
    },
    organizationId: apiKey.organizationId,
  };
}

/**
 * Check if API key has permission for an action
 */
export function hasPermission(
  apiKey: ApiKeyData,
  resource: string,
  action: string
): boolean {
  // Empty permissions means full access (for backwards compatibility)
  if (apiKey.permissions.length === 0) {
    return true;
  }

  const resourcePermission = apiKey.permissions.find(
    (p) => p.resource === resource || p.resource === "*"
  );

  if (!resourcePermission) {
    return false;
  }

  return (
    resourcePermission.actions.includes(action) ||
    resourcePermission.actions.includes("*")
  );
}

// ============== RATE LIMITING ==============

/**
 * Check rate limit for an API key
 */
export async function checkRateLimit(apiKeyId: string): Promise<RateLimitResult> {
  const apiKey = await db.apiKey.findUnique({
    where: { id: apiKeyId },
    select: { rateLimit: true },
  });

  if (!apiKey) {
    return { allowed: false, remaining: 0, resetAt: new Date() };
  }

  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - 1);

  // Count requests in the last hour
  const requestCount = await db.apiKeyUsage.count({
    where: {
      apiKeyId,
      createdAt: { gte: windowStart },
    },
  });

  const remaining = Math.max(0, apiKey.rateLimit - requestCount);
  const resetAt = new Date();
  resetAt.setHours(resetAt.getHours() + 1);

  return {
    allowed: requestCount < apiKey.rateLimit,
    remaining,
    resetAt,
  };
}

/**
 * Log API key usage
 */
export async function logApiKeyUsage(
  apiKeyId: string,
  data: {
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
  }
): Promise<void> {
  await db.apiKeyUsage.create({
    data: {
      apiKeyId,
      endpoint: data.endpoint,
      method: data.method,
      statusCode: data.statusCode,
      responseTime: data.responseTime,
    },
  });
}

// ============== KEY MANAGEMENT ==============

/**
 * Get all API keys for an organization
 */
export async function getOrganizationApiKeys(
  organizationId: string
): Promise<ApiKeyData[]> {
  const keys = await db.apiKey.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { usageLogs: true },
      },
    },
  });

  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    permissions: (k.permissions as unknown as ApiKeyPermission[]) || [],
    rateLimit: k.rateLimit,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    isActive: k.isActive,
    createdAt: k.createdAt,
    usageCount: k._count.usageLogs,
  }));
}

/**
 * Update API key settings
 */
export async function updateApiKey(
  apiKeyId: string,
  organizationId: string,
  updates: {
    name?: string;
    permissions?: ApiKeyPermission[];
    rateLimit?: number;
    isActive?: boolean;
  }
): Promise<void> {
  const key = await db.apiKey.findFirst({
    where: { id: apiKeyId, organizationId },
  });

  if (!key) {
    throw new Error("API key not found");
  }

  await db.apiKey.update({
    where: { id: apiKeyId },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.permissions && { permissions: updates.permissions as unknown as object[] }),
      ...(updates.rateLimit !== undefined && { rateLimit: updates.rateLimit }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
    },
  });
}

/**
 * Revoke (delete) an API key
 */
export async function revokeApiKey(
  apiKeyId: string,
  organizationId: string
): Promise<void> {
  const key = await db.apiKey.findFirst({
    where: { id: apiKeyId, organizationId },
  });

  if (!key) {
    throw new Error("API key not found");
  }

  await db.apiKey.delete({ where: { id: apiKeyId } });
}

/**
 * Get API key usage statistics
 */
export async function getApiKeyUsageStats(
  apiKeyId: string,
  days = 7
): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  requestsByEndpoint: Record<string, number>;
  requestsByDay: Array<{ date: string; count: number }>;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const usageLogs = await db.apiKeyUsage.findMany({
    where: {
      apiKeyId,
      createdAt: { gte: since },
    },
    select: {
      endpoint: true,
      statusCode: true,
      responseTime: true,
      createdAt: true,
    },
  });

  const totalRequests = usageLogs.length;
  const successfulRequests = usageLogs.filter((l) => l.statusCode < 400).length;
  const failedRequests = totalRequests - successfulRequests;
  const avgResponseTime =
    totalRequests > 0
      ? usageLogs.reduce((sum, l) => sum + l.responseTime, 0) / totalRequests
      : 0;

  // Group by endpoint
  const requestsByEndpoint: Record<string, number> = {};
  usageLogs.forEach((l) => {
    requestsByEndpoint[l.endpoint] = (requestsByEndpoint[l.endpoint] || 0) + 1;
  });

  // Group by day
  const requestsByDayMap: Record<string, number> = {};
  usageLogs.forEach((l) => {
    const date = l.createdAt.toISOString().split("T")[0];
    requestsByDayMap[date] = (requestsByDayMap[date] || 0) + 1;
  });

  const requestsByDay = Object.entries(requestsByDayMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    avgResponseTime: Math.round(avgResponseTime),
    requestsByEndpoint,
    requestsByDay,
  };
}

