/**
 * API Client
 * Type-safe fetch wrapper for frontend API calls
 */

import type { ApiResponse, ApiError, PaginationParams } from "@/types/api";

// ============== CONFIGURATION ==============

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
}

// ============== ERROR HANDLING ==============

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: Record<string, string[]>;

  constructor(error: ApiError, status: number) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }
}

// ============== HELPERS ==============

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

function buildPaginationParams(pagination?: PaginationParams): Record<string, string | number | undefined> {
  if (!pagination) return {};

  return {
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
  };
}

// ============== CORE CLIENT ==============

async function request<T>(
  path: string,
  config: RequestConfig = {}
): Promise<T> {
  const { params, timeout = 30000, ...fetchConfig } = config;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const url = buildUrl(path, params);

    const response = await fetch(url, {
      ...fetchConfig,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...fetchConfig.headers,
      },
    });

    clearTimeout(timeoutId);

    // Handle no content
    if (response.status === 204) {
      return undefined as T;
    }

    const data = await response.json() as ApiResponse<T>;

    if (!response.ok || !data.success) {
      const errorResponse = data as { success: false; error: ApiError };
      throw new ApiClientError(errorResponse.error, response.status);
    }

    return (data as { success: true; data: T }).data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiClientError(
        { code: "NETWORK_ERROR", message: "Request timed out" },
        408
      );
    }

    throw new ApiClientError(
      { code: "NETWORK_ERROR", message: "Network error occurred" },
      0
    );
  }
}

// ============== HTTP METHODS ==============

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>(path, { method: "GET", params }),

  post: <T>(path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      params,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>(path, { method: "DELETE", params }),
};

// ============== PAGINATED RESPONSE TYPE ==============

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
    totalPages: number;
  };
}

// ============== API ENDPOINTS ==============

// ---------- Auth ----------
export const authApi = {
  getSession: () => api.get<{ user: { id: string; email: string; name: string; role: string } | null }>("/api/auth/session"),
};

// ---------- Projects ----------
export interface Project {
  id: string;
  title: string;
  description?: string;
  slug: string;
  status: string;
  population?: string;
  intervention?: string;
  comparison?: string;
  outcome?: string;
  isPublic: boolean;
  requireDualScreening: boolean;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    works: number;
    members: number;
  };
}

export interface CreateProjectInput {
  title: string;
  description?: string;
  population?: string;
  intervention?: string;
  comparison?: string;
  outcome?: string;
  isPublic?: boolean;
  requireDualScreening?: boolean;
  organizationId?: string;
}

export const projectsApi = {
  list: (params?: PaginationParams & { status?: string; search?: string }) =>
    api.get<PaginatedResponse<Project>>("/api/projects", {
      ...buildPaginationParams(params),
      status: params?.status,
      search: params?.search,
    }),

  get: (id: string) => api.get<Project>(`/api/projects/${id}`),

  create: (data: CreateProjectInput) => api.post<Project>("/api/projects", data),

  update: (id: string, data: Partial<CreateProjectInput>) =>
    api.patch<Project>(`/api/projects/${id}`, data),

  delete: (id: string) => api.delete<void>(`/api/projects/${id}`),

  getStats: (id: string) =>
    api.get<{
      totalStudies: number;
      includedStudies: number;
      excludedStudies: number;
      pendingStudies: number;
      conflicts: number;
    }>(`/api/projects/${id}/stats`),
};

// ---------- Project Members ----------
export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  joinedAt: string;
}

export const projectMembersApi = {
  list: (projectId: string) =>
    api.get<ProjectMember[]>(`/api/projects/${projectId}/members`),

  add: (projectId: string, data: { userId: string; role: string }) =>
    api.post<ProjectMember>(`/api/projects/${projectId}/members`, data),

  update: (projectId: string, memberId: string, data: { role: string }) =>
    api.patch<ProjectMember>(`/api/projects/${projectId}/members/${memberId}`, data),

  remove: (projectId: string, memberId: string) =>
    api.delete<void>(`/api/projects/${projectId}/members/${memberId}`),
};

// ---------- Works/Studies ----------
export interface Work {
  id: string;
  title: string;
  abstract?: string;
  authors: Array<{ name: string; affiliation?: string }>;
  year?: number;
  journal?: string;
  doi?: string;
  pmid?: string;
  url?: string;
  keywords?: string[];
  citationCount?: number;
  createdAt: string;
}

export interface ProjectWork {
  id: string;
  projectId: string;
  workId: string;
  status: string;
  phase: string;
  finalDecision?: string;
  importSource?: string;
  work: Work;
  createdAt: string;
}

export const worksApi = {
  list: (projectId: string, params?: PaginationParams & { status?: string; phase?: string; search?: string }) =>
    api.get<PaginatedResponse<ProjectWork>>(`/api/projects/${projectId}/works`, {
      ...buildPaginationParams(params),
      status: params?.status,
      phase: params?.phase,
      search: params?.search,
    }),

  get: (projectId: string, workId: string) =>
    api.get<ProjectWork>(`/api/projects/${projectId}/works/${workId}`),
};

// ---------- Import ----------
export interface ImportBatch {
  id: string;
  projectId: string;
  filename: string;
  fileType: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  duplicatesFound: number;
  errorsCount: number;
  createdAt: string;
}

export const importApi = {
  create: (projectId: string, data: { filename: string; fileType: string; content: string }) =>
    api.post<ImportBatch>(`/api/projects/${projectId}/import`, data),

  getBatch: (projectId: string, batchId: string) =>
    api.get<ImportBatch>(`/api/projects/${projectId}/import/${batchId}`),

  process: (projectId: string, batchId: string) =>
    api.post<void>(`/api/projects/${projectId}/import/${batchId}/process`),

  listBatches: (projectId: string) =>
    api.get<ImportBatch[]>(`/api/projects/${projectId}/import`),
};

// ---------- Screening ----------
export interface ScreeningQueueItem {
  id: string;
  workId: string;
  status: string;
  phase: string;
  title: string;
  authors: Array<{ name: string }>;
  abstract?: string;
  journal?: string;
  year?: number;
  doi?: string;
  aiSuggestion?: string;
  aiConfidence?: number;
  aiReasoning?: string;
  userDecision?: string;
  createdAt: string;
}

export interface ScreeningDecision {
  projectWorkId: string;
  phase: string;
  decision: "INCLUDE" | "EXCLUDE" | "MAYBE";
  reasoning?: string;
  exclusionReason?: string;
  timeSpentMs?: number;
  followedAi?: boolean;
}

export const screeningApi = {
  getQueue: (projectId: string, params?: PaginationParams & { phase?: string; status?: string }) =>
    api.get<PaginatedResponse<ScreeningQueueItem>>(`/api/projects/${projectId}/screening/queue`, {
      ...buildPaginationParams(params),
      phase: params?.phase,
      status: params?.status,
    }),

  submitDecision: (projectId: string, decision: ScreeningDecision) =>
    api.post<void>(`/api/projects/${projectId}/screening/decisions`, decision),

  batchDecision: (projectId: string, data: { projectWorkIds: string[]; phase: string; decision: string }) =>
    api.post<{ processed: number; failed: number }>(`/api/projects/${projectId}/screening/batch`, data),

  getProgress: (projectId: string) =>
    api.get<{
      total: number;
      included: number;
      excluded: number;
      maybe: number;
      pending: number;
      conflicts: number;
      phases: Record<string, { total: number; screened: number; progress: number }>;
    }>(`/api/projects/${projectId}/screening/progress`),

  getAiSuggestion: (projectId: string, projectWorkId: string) =>
    api.get<{ suggestion: string; confidence: number; reasoning: string }>(
      `/api/projects/${projectId}/screening/ai-suggestions`,
      { projectWorkId }
    ),
};

// ---------- Conflicts ----------
export interface Conflict {
  id: string;
  projectId: string;
  projectWorkId: string;
  phase: string;
  status: string;
  decisions: Array<{
    reviewerId: string;
    reviewerName?: string;
    decision: string;
    reasoning?: string;
  }>;
  work?: {
    title: string;
    authors: Array<{ name: string }>;
    year?: number;
  };
  resolution?: {
    finalDecision: string;
    reasoning: string;
    resolver: { id: string; name: string };
    createdAt: string;
  };
  createdAt: string;
}

export const conflictsApi = {
  list: (projectId: string, params?: PaginationParams & { status?: string }) =>
    api.get<PaginatedResponse<Conflict>>(`/api/projects/${projectId}/conflicts`, {
      ...buildPaginationParams(params),
      status: params?.status,
    }),

  get: (projectId: string, conflictId: string) =>
    api.get<Conflict>(`/api/projects/${projectId}/conflicts/${conflictId}`),

  resolve: (projectId: string, conflictId: string, data: { finalDecision: string; reasoning: string }) =>
    api.patch<Conflict>(`/api/projects/${projectId}/conflicts/${conflictId}`, {
      action: "resolve",
      ...data,
    }),

  escalate: (projectId: string, conflictId: string, data: { reason: string }) =>
    api.patch<Conflict>(`/api/projects/${projectId}/conflicts/${conflictId}`, {
      action: "escalate",
      ...data,
    }),
};

// ---------- Extraction ----------
export interface ExtractionTemplate {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    required: boolean;
    options?: string[];
    validation?: Record<string, unknown>;
  }>;
  isActive: boolean;
  createdAt: string;
}

export interface ExtractionData {
  id: string;
  projectWorkId: string;
  templateId: string;
  extractorId: string;
  data: Record<string, unknown>;
  status: string;
  createdAt: string;
}

export const extractionApi = {
  getTemplates: (projectId: string) =>
    api.get<ExtractionTemplate[]>(`/api/projects/${projectId}/extraction/templates`),

  createTemplate: (projectId: string, data: Omit<ExtractionTemplate, "id" | "projectId" | "createdAt">) =>
    api.post<ExtractionTemplate>(`/api/projects/${projectId}/extraction/templates`, data),

  updateTemplate: (projectId: string, templateId: string, data: Partial<ExtractionTemplate>) =>
    api.patch<ExtractionTemplate>(`/api/projects/${projectId}/extraction/templates/${templateId}`, data),

  getData: (projectId: string, projectWorkId: string) =>
    api.get<ExtractionData>(`/api/projects/${projectId}/extraction/data/${projectWorkId}`),

  submitData: (projectId: string, data: { projectWorkId: string; templateId: string; data: Record<string, unknown> }) =>
    api.post<ExtractionData>(`/api/projects/${projectId}/extraction/data`, data),

  getAiAssist: (projectId: string, projectWorkId: string, templateId: string) =>
    api.get<{ extractedData: Record<string, unknown>; confidence: Record<string, number> }>(
      `/api/projects/${projectId}/extraction/ai-assist`,
      { projectWorkId, templateId }
    ),
};

// ---------- Quality Assessment ----------
export interface QualityTool {
  id: string;
  projectId: string;
  name: string;
  type: string;
  domains: Array<{
    id: string;
    name: string;
    description?: string;
    questions?: Array<{ id: string; text: string; options: string[] }>;
  }>;
  isActive: boolean;
}

export interface QualityAssessment {
  id: string;
  projectWorkId: string;
  toolId: string;
  assessorId: string;
  domainScores: Record<string, { score: string; reasoning?: string }>;
  overallRisk: string;
  status: string;
  createdAt: string;
}

export const qualityApi = {
  getTools: (projectId: string) =>
    api.get<QualityTool[]>(`/api/projects/${projectId}/quality/tools`),

  createTool: (projectId: string, data: Omit<QualityTool, "id" | "projectId">) =>
    api.post<QualityTool>(`/api/projects/${projectId}/quality/tools`, data),

  getAssessments: (projectId: string, params?: { projectWorkId?: string }) =>
    api.get<QualityAssessment[]>(`/api/projects/${projectId}/quality/assessments`, params),

  submitAssessment: (projectId: string, data: Omit<QualityAssessment, "id" | "createdAt">) =>
    api.post<QualityAssessment>(`/api/projects/${projectId}/quality/assessments`, data),
};

// ---------- Library ----------
export interface LibraryItem {
  id: string;
  workId: string;
  userId: string;
  folderId?: string;
  tags: string[];
  notes?: string;
  rating?: number;
  readingStatus: string;
  work: Work;
  createdAt: string;
}

export interface LibraryFolder {
  id: string;
  name: string;
  parentId?: string;
  userId: string;
  itemCount?: number;
  createdAt: string;
}

export const libraryApi = {
  getItems: (params?: PaginationParams & { folderId?: string; tags?: string; status?: string }) =>
    api.get<PaginatedResponse<LibraryItem>>("/api/library", {
      ...buildPaginationParams(params),
      folderId: params?.folderId,
      tags: params?.tags,
      status: params?.status,
    }),

  addItem: (data: { workId: string; folderId?: string; tags?: string[]; notes?: string }) =>
    api.post<LibraryItem>("/api/library", data),

  updateItem: (itemId: string, data: Partial<LibraryItem>) =>
    api.patch<LibraryItem>(`/api/library/${itemId}`, data),

  deleteItem: (itemId: string) => api.delete<void>(`/api/library/${itemId}`),

  getFolders: () => api.get<LibraryFolder[]>("/api/library/folders"),

  createFolder: (data: { name: string; parentId?: string }) =>
    api.post<LibraryFolder>("/api/library/folders", data),

  updateFolder: (folderId: string, data: { name?: string }) =>
    api.patch<LibraryFolder>(`/api/library/folders/${folderId}`, data),

  deleteFolder: (folderId: string) => api.delete<void>(`/api/library/folders/${folderId}`),
};

// ---------- Organizations ----------
export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logoUrl?: string;
  primaryColor: string;
  tier: string;
  maxProjects: number;
  maxMembers: number;
  memberCount?: number;
  projectCount?: number;
  createdAt: string;
  role?: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  role: string;
  joinedAt: string;
}

export const organizationsApi = {
  list: () => api.get<Organization[]>("/api/organizations"),

  get: (orgId: string) => api.get<Organization>(`/api/organizations/${orgId}`),

  create: (data: { name: string; slug?: string }) =>
    api.post<Organization>("/api/organizations", data),

  update: (orgId: string, data: Partial<Organization>) =>
    api.patch<Organization>(`/api/organizations/${orgId}`, data),

  delete: (orgId: string) => api.delete<void>(`/api/organizations/${orgId}`),

  getMembers: (orgId: string) =>
    api.get<OrganizationMember[]>(`/api/organizations/${orgId}/members`),

  addMember: (orgId: string, data: { userId: string; role: string }) =>
    api.post<OrganizationMember>(`/api/organizations/${orgId}/members`, data),

  updateMember: (orgId: string, data: { userId: string; role: string }) =>
    api.patch<OrganizationMember>(`/api/organizations/${orgId}/members`, data),

  removeMember: (orgId: string, userId: string) =>
    api.delete<void>(`/api/organizations/${orgId}/members`, { userId }),
};

// ---------- Notifications ----------
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: (params?: { unread?: boolean; projectId?: string }) =>
    api.get<Notification[]>("/api/notifications", params),

  markRead: (notificationId: string) =>
    api.patch<Notification>(`/api/notifications/${notificationId}`, { isRead: true }),

  markAllRead: () => api.post<void>("/api/notifications/read-all"),
};

