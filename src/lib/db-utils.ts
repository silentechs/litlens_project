/**
 * Database Utilities
 * Query optimization, pagination helpers, and common patterns
 */

import { Prisma } from "@prisma/client";

// ============== PAGINATION ==============

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Build pagination args for Prisma
 */
export function buildPaginationArgs(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Build orderBy clause
 */
export function buildOrderBy(
  sortBy: string | undefined,
  sortOrder: "asc" | "desc" = "desc",
  defaultField = "createdAt"
): Record<string, "asc" | "desc"> {
  return {
    [sortBy || defaultField]: sortOrder,
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

// ============== QUERY BUILDERS ==============

/**
 * Build search conditions for text fields
 */
export function buildSearchCondition(
  searchTerm: string,
  fields: string[]
): Prisma.JsonObject {
  if (!searchTerm.trim()) {
    return {};
  }

  return {
    OR: fields.map((field) => ({
      [field]: {
        contains: searchTerm,
        mode: "insensitive",
      },
    })),
  };
}

/**
 * Build date range filter
 */
export function buildDateRangeFilter(
  field: string,
  startDate?: Date,
  endDate?: Date
): Record<string, unknown> | null {
  if (!startDate && !endDate) {
    return null;
  }

  const filter: Record<string, unknown> = {};

  if (startDate) {
    filter.gte = startDate;
  }
  if (endDate) {
    filter.lte = endDate;
  }

  return { [field]: filter };
}

/**
 * Build enum filter with multiple values
 */
export function buildEnumFilter<T extends string>(
  field: string,
  values: T | T[] | undefined
): Record<string, unknown> | null {
  if (!values) return null;

  if (Array.isArray(values)) {
    return values.length > 0 ? { [field]: { in: values } } : null;
  }

  return { [field]: values };
}

// ============== BATCH OPERATIONS ==============

/**
 * Process items in batches to avoid overwhelming the database
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Batch create with chunking
 */
export async function batchCreate<T>(
  items: T[],
  createFn: (batch: T[]) => Promise<{ count: number }>,
  batchSize = 100
): Promise<number> {
  let totalCreated = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const result = await createFn(batch);
    totalCreated += result.count;
  }

  return totalCreated;
}

// ============== SELECT HELPERS ==============

/**
 * Common user select fields
 */
export const userSelectMinimal = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

/**
 * Common work select fields
 */
export const workSelectMinimal = {
  id: true,
  title: true,
  authors: true,
  year: true,
  journal: true,
  doi: true,
} as const;

export const workSelectFull = {
  ...workSelectMinimal,
  abstract: true,
  pmid: true,
  url: true,
  keywords: true,
  citationCount: true,
} as const;

/**
 * Common project select fields
 */
export const projectSelectMinimal = {
  id: true,
  title: true,
  slug: true,
  status: true,
} as const;

// ============== TRANSACTION HELPERS ==============

/**
 * Retry a transaction on conflict
 */
export async function retryTransaction<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if it's a retryable error (e.g., deadlock, write conflict)
      const errorMessage = lastError.message.toLowerCase();
      const isRetryable =
        errorMessage.includes("deadlock") ||
        errorMessage.includes("write conflict") ||
        errorMessage.includes("transaction");

      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * Math.pow(2, attempt))
      );
    }
  }

  throw lastError;
}

// ============== QUERY OPTIMIZATION ==============

/**
 * Build include clause with depth limit
 */
export function buildIncludeWithDepth(
  relations: string[],
  maxDepth = 2
): Record<string, boolean | Record<string, unknown>> {
  const include: Record<string, boolean | Record<string, unknown>> = {};

  relations.forEach((relation) => {
    const parts = relation.split(".");
    let current: Record<string, boolean | Record<string, unknown>> = include;

    parts.forEach((part, index) => {
      if (index >= maxDepth) return;

      if (index === parts.length - 1) {
        current[part] = true;
      } else {
        if (!current[part]) {
          current[part] = { include: {} };
        }
        current = (current[part] as { include: Record<string, unknown> }).include as Record<string, boolean | Record<string, unknown>>;
      }
    });
  });

  return include;
}

/**
 * Count queries optimizer - use _count instead of separate count queries
 */
export function buildCountInclude(
  relations: string[]
): { _count: { select: Record<string, boolean> } } {
  return {
    _count: {
      select: Object.fromEntries(relations.map((r) => [r, true])),
    },
  };
}

// ============== CURSOR PAGINATION ==============

export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
  direction?: "forward" | "backward";
}

export interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
}

/**
 * Build cursor pagination args
 */
export function buildCursorArgs(
  params: CursorPaginationParams,
  cursorField = "id"
): {
  cursor?: Record<string, string>;
  take: number;
  skip?: number;
} {
  const args: {
    cursor?: Record<string, string>;
    take: number;
    skip?: number;
  } = {
    take: params.limit + 1, // Fetch one extra to check if there's more
  };

  if (params.cursor) {
    args.cursor = { [cursorField]: params.cursor };
    args.skip = 1; // Skip the cursor itself
  }

  return args;
}

/**
 * Process cursor pagination result
 */
export function processCursorResult<T extends { id: string }>(
  data: T[],
  limit: number
): CursorPaginatedResult<T> {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  return {
    data: items,
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    prevCursor: items.length > 0 ? items[0].id : null,
    hasMore,
  };
}

