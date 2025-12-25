/**
 * API Utilities Index
 */

export * from "./error-handler";
export * from "./response";

// Re-export commonly used functions
export {
  handleApiError,
  withErrorHandler,
  ApiError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
} from "./error-handler";

export {
  success,
  created,
  noContent,
  paginated,
  cursorPaginated,
  buildPaginationArgs,
  buildCursorPaginationArgs,
  buildOrderBy,
  buildSearchFilter,
  buildWhereClause,
} from "./response";

