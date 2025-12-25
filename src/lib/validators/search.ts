import { z } from "zod";

// ============== SEARCH SCHEMAS ==============

export const externalSearchSchema = z.object({
  query: z.string().min(1).max(500),
  sources: z.array(z.enum(["openalex", "pubmed", "crossref"])).default(["openalex"]),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  filters: z.object({
    yearFrom: z.coerce.number().int().min(1900).max(2100).optional(),
    yearTo: z.coerce.number().int().min(1900).max(2100).optional(),
    type: z.string().optional(), // article, review, book, etc.
    openAccess: z.boolean().optional(),
  }).optional(),
});

export const internalSearchSchema = z.object({
  query: z.string().min(1).max(500),
  projectId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  filters: z.object({
    status: z.enum(["PENDING", "SCREENING", "CONFLICT", "INCLUDED", "EXCLUDED", "MAYBE"]).optional(),
    phase: z.enum(["TITLE_ABSTRACT", "FULL_TEXT", "FINAL"]).optional(),
    yearFrom: z.coerce.number().int().optional(),
    yearTo: z.coerce.number().int().optional(),
  }).optional(),
});

export const semanticSearchSchema = z.object({
  query: z.string().min(10).max(2000),
  projectId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  threshold: z.coerce.number().min(0).max(1).default(0.7),
});

export const authorSearchSchema = z.object({
  query: z.string().min(2).max(200),
  source: z.enum(["openalex", "all"]).default("openalex"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ============== WORK SCHEMAS ==============

export const workAuthorSchema = z.object({
  name: z.string().min(1).max(200),
  orcid: z.string().optional().nullable(),
  affiliation: z.string().max(500).optional().nullable(),
  position: z.number().int().optional(),
});

export const createWorkSchema = z.object({
  title: z.string().min(1).max(1000),
  abstract: z.string().max(10000).optional(),
  authors: z.array(workAuthorSchema).default([]),
  year: z.number().int().min(1800).max(2100).optional(),
  publicationDate: z.string().datetime().optional(),
  journal: z.string().max(500).optional(),
  volume: z.string().max(50).optional(),
  issue: z.string().max(50).optional(),
  pages: z.string().max(50).optional(),
  publisher: z.string().max(500).optional(),
  doi: z.string().max(200).optional(),
  pmid: z.string().max(20).optional(),
  pmcid: z.string().max(20).optional(),
  url: z.string().url().optional(),
  keywords: z.array(z.string().max(100)).max(50).optional(),
  source: z.enum(["openalex", "pubmed", "crossref", "internal", "import", "semantic"]).optional(),
});

export const updateWorkSchema = createWorkSchema.partial();

// ============== TYPE EXPORTS ==============

export type ExternalSearchInput = z.infer<typeof externalSearchSchema>;
export type InternalSearchInput = z.infer<typeof internalSearchSchema>;
export type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;
export type AuthorSearchInput = z.infer<typeof authorSearchSchema>;
export type WorkAuthorInput = z.infer<typeof workAuthorSchema>;
export type CreateWorkInput = z.infer<typeof createWorkSchema>;
export type UpdateWorkInput = z.infer<typeof updateWorkSchema>;

