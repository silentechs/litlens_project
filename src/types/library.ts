/**
 * Library Domain Types
 * Personal library for storing and organizing works
 */

import type { WorkAuthor } from "./work";

// Reading status for library items
export type ReadingStatus = "TO_READ" | "READING" | "READ" | "ARCHIVED";

// Stub Prisma types if they are not available
type PrismaLibraryItem = any;
type PrismaLibraryFolder = any;

// ============== LIBRARY ITEM TYPES ==============

export interface LibraryItem extends PrismaLibraryItem {
  id: string;
  userId: string;
  workId: string;
  folderId: string | null;
  tags: string[];
  notes: string | null;
  rating: number | null;
  readingStatus: ReadingStatus;
  highlightColor: string | null;
  aiSummary: string | null;
  aiKeyInsights: any;
  lastAccessedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryItemWithWork extends LibraryItem {
  work: {
    id: string;
    title: string;
    authors: WorkAuthor[];
    abstract: string | null;
    year: number | null;
    journal: string | null;
    doi: string | null;
    url: string | null;
    citationCount: number;
  };
  folder: LibraryFolder | null;
}

// ============== FOLDER TYPES ==============

export interface LibraryFolder extends PrismaLibraryFolder {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string;
  parentId: string | null;
  createdAt: Date;
}

export interface LibraryFolderWithCounts extends LibraryFolder {
  // Support both API shapes for compatibility
  _count?: {
    items: number;
    subFolders: number;
  };
  // API returns these flat fields
  itemCount?: number;
  subFolderCount?: number;
  subFolders?: LibraryFolderWithCounts[];
  children?: LibraryFolderWithCounts[];
}

/**
 * Helper to get item count from folder regardless of shape
 */
export function getFolderItemCount(folder: LibraryFolderWithCounts): number {
  return folder._count?.items ?? folder.itemCount ?? 0;
}

/**
 * Helper to get subfolder count from folder regardless of shape
 */
export function getFolderSubFolderCount(folder: LibraryFolderWithCounts): number {
  return folder._count?.subFolders ?? folder.subFolderCount ?? 0;
}

export interface LibraryFolderTree extends LibraryFolder {
  children: LibraryFolderTree[];
  itemCount: number;
}

// ============== INPUT TYPES ==============

export interface AddToLibraryInput {
  workId: string;
  folderId?: string;
  tags?: string[];
  notes?: string;
  rating?: number;
  readingStatus?: ReadingStatus;
}

export interface UpdateLibraryItemInput {
  folderId?: string | null;
  tags?: string[];
  notes?: string;
  rating?: number | null;
  readingStatus?: ReadingStatus;
  highlightColor?: string | null;
}

export interface CreateFolderInput {
  name: string;
  parentId?: string;
  color?: string;
  icon?: string;
}

export interface UpdateFolderInput {
  name?: string;
  parentId?: string | null;
  color?: string;
  icon?: string;
}

// ============== FILTER TYPES ==============

export interface LibraryFilters {
  folderId?: string | null; // null = root level
  search?: string;
  tags?: string[];
  readingStatus?: ReadingStatus;
  rating?: number;
  starred?: boolean;
  sortBy?: "title" | "addedAt" | "year" | "rating" | "lastAccessed";
  sortOrder?: "asc" | "desc";
}

// ============== STATS ==============

export interface LibraryStats {
  totalItems: number;
  totalFolders: number;
  byReadingStatus: Record<ReadingStatus, number>;
  recentlyAdded: number;
  starred: number;
  topTags: { tag: string; count: number }[];
}

// ============== BATCH OPERATIONS ==============

export interface BatchAddToLibraryInput {
  workIds: string[];
  folderId?: string;
  tags?: string[];
}

export interface BatchUpdateLibraryInput {
  itemIds: string[];
  folderId?: string | null;
  tags?: string[];
  readingStatus?: ReadingStatus;
}

export interface BatchMoveToFolderInput {
  itemIds: string[];
  folderId: string | null; // null = move to root
}

// ============== EXPORT ==============

export interface LibraryExportOptions {
  format: "ris" | "bibtex" | "csv" | "json";
  itemIds?: string[]; // if not provided, export all
  folderId?: string; // export specific folder
  includeNotes?: boolean;
  includeTags?: boolean;
}

