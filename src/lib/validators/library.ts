import { z } from "zod";

// ============== ENUMS ==============

export const readingStatusSchema = z.enum(["TO_READ", "READING", "READ", "ARCHIVED"]);

// ============== LIBRARY ITEM SCHEMAS ==============

export const addToLibrarySchema = z.object({
  workId: z.string().cuid(),
  folderId: z.string().cuid().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  readingStatus: readingStatusSchema.optional(),
});

export const updateLibraryItemSchema = z.object({
  folderId: z.string().cuid().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  readingStatus: readingStatusSchema.optional(),
  highlightColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

export const batchAddToLibrarySchema = z.object({
  workIds: z.array(z.string().cuid()).min(1).max(100),
  folderId: z.string().cuid().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const batchUpdateLibrarySchema = z.object({
  itemIds: z.array(z.string().cuid()).min(1).max(100),
  folderId: z.string().cuid().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  readingStatus: readingStatusSchema.optional(),
});

export const batchMoveToFolderSchema = z.object({
  itemIds: z.array(z.string().cuid()).min(1).max(100),
  folderId: z.string().cuid().nullable(),
});

// ============== FOLDER SCHEMAS ==============

export const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().cuid().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#3B82F6"),
  icon: z.string().max(50).default("folder"),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().cuid().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
});

// ============== FILTER SCHEMAS ==============

export const libraryFiltersSchema = z.object({
  folderId: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val,
    z.string().cuid().optional()
  ),
  search: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val,
    z.string().max(200).optional()
  ),
  tags: z.array(z.string()).optional(),
  readingStatus: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val,
    readingStatusSchema.optional()
  ),
  rating: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val,
    z.coerce.number().int().min(1).max(5).optional()
  ),
  starred: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val === 'true',
    z.boolean().optional()
  ),
  sortBy: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val,
    z.enum(["title", "addedAt", "year", "rating", "lastAccessed"]).optional()
  ),
  sortOrder: z.preprocess(
    (val) => (val === null || val === '') ? undefined : val,
    z.enum(["asc", "desc"]).optional()
  ),
});

// ============== EXPORT SCHEMAS ==============

export const libraryExportSchema = z.object({
  format: z.enum(["ris", "bibtex", "csv", "json"]),
  itemIds: z.array(z.string().cuid()).optional(),
  folderId: z.string().cuid().optional(),
  includeNotes: z.boolean().default(false),
  includeTags: z.boolean().default(true),
});

// ============== TYPE EXPORTS ==============

export type ReadingStatus = z.infer<typeof readingStatusSchema>;
export type AddToLibraryInput = z.infer<typeof addToLibrarySchema>;
export type UpdateLibraryItemInput = z.infer<typeof updateLibraryItemSchema>;
export type BatchAddToLibraryInput = z.infer<typeof batchAddToLibrarySchema>;
export type BatchUpdateLibraryInput = z.infer<typeof batchUpdateLibrarySchema>;
export type BatchMoveToFolderInput = z.infer<typeof batchMoveToFolderSchema>;
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type LibraryFilters = z.infer<typeof libraryFiltersSchema>;
export type LibraryExportOptions = z.infer<typeof libraryExportSchema>;

