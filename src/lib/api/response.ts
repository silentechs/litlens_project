/**
 * API Response Utilities
 * Standard response format for all API endpoints
 */

import { NextResponse } from "next/server";
import type { 
  ApiSuccessResponse, 
  ApiMeta, 
  PaginationMeta,
  CursorPaginationMeta 
} from "@/types/api";

// ============== SUCCESS RESPONSES ==============

/**
 * Create a success response with data
 */
export function success<T>(
  data: T,
  meta?: Partial<ApiMeta>,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        ...meta,
      },
    },
    { status }
  );
}

/**
 * Create a success response with no content
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Create a created response (201)
 */
export function created<T>(
  data: T,
  meta?: Partial<ApiMeta>
): NextResponse<ApiSuccessResponse<T>> {
  return success(data, meta, 201);
}

// ============== PAGINATED RESPONSES ==============

interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Create a paginated response
 */
export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): NextResponse<ApiSuccessResponse<PaginatedData<T>>> {
  const totalPages = Math.ceil(total / limit);
  
  return success({
    items,
    pagination: {
      total,
      page,
      limit,
      hasMore: page < totalPages,
      totalPages,
    },
  });
}

interface CursorPaginatedData<T> {
  items: T[];
  pageInfo: CursorPaginationMeta;
}

/**
 * Create a cursor-paginated response
 */
export function cursorPaginated<T extends { id: string }>(
  items: T[],
  limit: number,
  hasMore: boolean
): NextResponse<ApiSuccessResponse<CursorPaginatedData<T>>> {
  return success({
    items,
    pageInfo: {
      hasNextPage: hasMore,
      hasPreviousPage: false, // Would need to track this differently
      startCursor: items[0]?.id ?? null,
      endCursor: items[items.length - 1]?.id ?? null,
    },
  });
}

// ============== PAGINATION HELPERS ==============

/**
 * Calculate pagination offset
 */
export function getPaginationOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Build Prisma pagination args
 */
export function buildPaginationArgs(page: number, limit: number) {
  return {
    skip: getPaginationOffset(page, limit),
    take: limit,
  };
}

/**
 * Build Prisma cursor pagination args
 */
export function buildCursorPaginationArgs(cursor: string | undefined, limit: number) {
  return cursor
    ? {
        skip: 1,
        cursor: { id: cursor },
        take: limit + 1, // Fetch one extra to check if there's more
      }
    : {
        take: limit + 1,
      };
}

// ============== SORTING HELPERS ==============

type SortOrder = "asc" | "desc";

/**
 * Build Prisma orderBy clause
 */
export function buildOrderBy(
  sortBy: string | undefined,
  sortOrder: SortOrder = "desc",
  defaultSortBy: string = "createdAt"
): Record<string, SortOrder> {
  return {
    [sortBy || defaultSortBy]: sortOrder,
  };
}

/**
 * Build complex orderBy for nested fields
 */
export function buildNestedOrderBy(
  sortBy: string | undefined,
  sortOrder: SortOrder = "desc",
  defaultSortBy: string = "createdAt"
): Record<string, unknown> {
  const field = sortBy || defaultSortBy;
  const parts = field.split(".");
  
  if (parts.length === 1) {
    return { [field]: sortOrder };
  }
  
  // Build nested structure
  let result: Record<string, unknown> = { [parts[parts.length - 1]]: sortOrder };
  for (let i = parts.length - 2; i >= 0; i--) {
    result = { [parts[i]]: result };
  }
  
  return result;
}

// ============== FILTER HELPERS ==============

/**
 * Build Prisma where clause for text search
 */
export function buildSearchFilter(
  search: string | undefined,
  fields: string[]
): Record<string, unknown> | undefined {
  if (!search || search.trim() === "") {
    return undefined;
  }
  
  return {
    OR: fields.map((field) => ({
      [field]: {
        contains: search.trim(),
        mode: "insensitive",
      },
    })),
  };
}

/**
 * Build Prisma where clause combining multiple filters
 */
export function buildWhereClause(
  filters: Record<string, unknown>
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      where[key] = value;
    }
  }
  
  return where;
}

// ============== RESPONSE HEADERS ==============

/**
 * Add cache headers to response
 */
export function withCacheHeaders<T>(
  response: NextResponse<T>,
  maxAge: number = 60,
  staleWhileRevalidate: number = 300
): NextResponse<T> {
  response.headers.set(
    "Cache-Control",
    `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  );
  return response;
}

/**
 * Add no-cache headers to response
 */
export function withNoCacheHeaders<T>(
  response: NextResponse<T>
): NextResponse<T> {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

