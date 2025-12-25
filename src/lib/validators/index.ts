/**
 * Central validator exports
 * All Zod schemas and their inferred types
 */

export * from "./project";
export * from "./screening";
export * from "./library";
export * from "./extraction";
export * from "./search";

// ============== COMMON SCHEMAS ==============

import { z } from "zod";

// ID validation
export const idSchema = z.string().cuid();
export const idParamsSchema = z.object({ id: idSchema });

// Pagination - handles null from searchParams.get() gracefully
export const paginationSchema = z.object({
  page: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? undefined : val,
    z.coerce.number().int().positive().default(1)
  ),
  limit: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? undefined : val,
    z.coerce.number().int().min(1).max(100).default(20)
  ),
  sortBy: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val,
    z.string().optional()
  ),
  sortOrder: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val,
    z.enum(["asc", "desc"]).optional().default("desc")
  ),
});

// Cursor pagination
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(["forward", "backward"]).default("forward"),
});

// Date range
export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  },
  { message: "From date must be before or equal to to date" }
);

// Search params
export const searchParamsSchema = z.object({
  query: z.string().max(500).optional(),
  filters: z.record(z.unknown()).optional(),
});

// ============== VALIDATION HELPERS ==============

/**
 * Parse and validate request body with Zod schema
 */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  const body = await request.json();
  return schema.parse(body);
}

/**
 * Parse and validate URL search params with Zod schema
 */
export function parseSearchParams<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  const params: Record<string, string | string[]> = {};
  
  searchParams.forEach((value, key) => {
    if (params[key]) {
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  });
  
  return schema.parse(params);
}

/**
 * Safe parse that returns result object
 */
export function safeParse<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// ============== TYPE EXPORTS ==============

export type IdParams = z.infer<typeof idParamsSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type CursorPaginationInput = z.infer<typeof cursorPaginationSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type SearchParams = z.infer<typeof searchParamsSchema>;

