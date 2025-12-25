/**
 * API Types - Standard response/error types for all API endpoints
 */

// ============== API RESPONSE TYPES ==============

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ApiMeta {
  pagination?: PaginationMeta;
  timestamp: string;
  requestId: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  totalPages: number;
}

export interface CursorPaginationMeta {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, string[]>;
  requestId?: string;
}

// ============== ERROR CODES ==============

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "BAD_REQUEST"
  | "UNPROCESSABLE_ENTITY"
  | "SERVICE_UNAVAILABLE"
  | "UNKNOWN";

// ============== PAGINATION PARAMS ==============

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
}

// ============== FILTER PARAMS ==============

export interface DateRangeFilter {
  from?: string; // ISO date
  to?: string;   // ISO date
}

export interface SearchParams {
  query?: string;
  filters?: Record<string, string | string[] | boolean | number>;
}

// ============== SSE EVENT TYPES ==============

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  data: T;
  timestamp: number;
}

export type SSEEventType =
  | "import:progress"
  | "import:completed"
  | "import:error"
  | "screening:conflict"
  | "screening:progress"
  | "ai:analysis:started"
  | "ai:analysis:progress"
  | "ai:analysis:completed"
  | "project:update"
  | "notification:new"
  | "export:progress"
  | "export:completed"
  | "heartbeat";

export interface ImportProgressEvent {
  batchId: string;
  projectId: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  duplicatesFound: number;
  errorsCount: number;
}

export interface ScreeningConflictEvent {
  projectId: string;
  projectWorkId: string;
  conflictId: string;
  phase: string;
}

// ============== HTTP METHODS ==============

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// ============== REQUEST CONTEXT ==============

export interface RequestContext {
  userId?: string;
  organizationId?: string;
  projectId?: string;
  requestId: string;
  ip?: string;
  userAgent?: string;
}

