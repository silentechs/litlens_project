/**
 * Canonical Work Entity Types
 * Represents scholarly works (papers, articles, etc.)
 */

import type { Work as PrismaWork } from "@prisma/client";

// ============== BASE TYPES ==============

export interface Work extends PrismaWork {}

// ============== AUTHOR TYPES ==============

export interface WorkAuthor {
  name: string;
  orcid?: string | null;
  affiliation?: string | null;
  position?: number;
}

// ============== WORK WITH RELATIONS ==============

export interface WorkWithDetails extends Omit<Work, "authors"> {
  authors: WorkAuthor[];
  projectWorks?: {
    id: string;
    projectId: string;
    status: string;
  }[];
  libraryItems?: {
    id: string;
    userId: string;
    tags: string[];
  }[];
}

// ============== SEARCH RESULT TYPES ==============

export interface WorkSearchResult {
  id: string;
  title: string;
  authors: WorkAuthor[];
  abstract: string | null;
  year: number | null;
  journal: string | null;
  doi: string | null;
  pmid: string | null;
  url: string | null;
  citationCount: number;
  source: WorkSource;
  relevanceScore?: number;
}

export type WorkSource = 
  | "openalex" 
  | "pubmed" 
  | "crossref" 
  | "internal" 
  | "import"
  | "semantic";

// ============== EXTERNAL API TYPES ==============

export interface OpenAlexWork {
  id: string;
  doi: string | null;
  title: string;
  display_name: string;
  publication_year: number;
  publication_date: string;
  type: string;
  cited_by_count: number;
  
  // Authorships
  authorships: OpenAlexAuthorship[];
  
  // Venue
  primary_location: {
    source?: {
      display_name: string;
      issn_l?: string;
    };
  } | null;
  
  // Abstract
  abstract_inverted_index?: Record<string, number[]>;
  
  // Identifiers
  ids: {
    openalex: string;
    doi?: string;
    pmid?: string;
    pmcid?: string;
  };
  
  // Concepts
  concepts: {
    display_name: string;
    score: number;
  }[];
  
  // References
  referenced_works: string[];
}

export interface OpenAlexAuthorship {
  author: {
    id: string;
    display_name: string;
    orcid?: string;
  };
  institutions: {
    display_name: string;
  }[];
  author_position: "first" | "middle" | "last";
}

// ============== TRANSFORM FUNCTIONS (type signatures) ==============

export interface WorkTransformer {
  fromOpenAlex(work: OpenAlexWork): WorkSearchResult;
  fromPubMed(work: PubMedArticle): WorkSearchResult;
  fromCrossref(work: CrossrefWork): WorkSearchResult;
}

// PubMed types (simplified)
export interface PubMedArticle {
  uid: string;
  title: string;
  authors?: { name: string; authtype: string }[];
  source: string;
  pubdate: string;
  epubdate?: string;
  doi?: string;
  fulljournalname?: string;
}

// Crossref types (simplified)
export interface CrossrefWork {
  DOI: string;
  title: string[];
  author?: { given: string; family: string; ORCID?: string }[];
  "container-title"?: string[];
  published?: { "date-parts": number[][] };
  abstract?: string;
  "is-referenced-by-count"?: number;
}

// ============== INPUT TYPES ==============

export interface CreateWorkInput {
  title: string;
  abstract?: string;
  authors: WorkAuthor[];
  year?: number;
  publicationDate?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  url?: string;
  keywords?: string[];
  source?: WorkSource;
}

export interface UpdateWorkInput {
  title?: string;
  abstract?: string;
  authors?: WorkAuthor[];
  year?: number;
  publicationDate?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  keywords?: string[];
}

// ============== ENRICHMENT ==============

export interface WorkEnrichmentResult {
  workId: string;
  enriched: boolean;
  source: WorkSource;
  fieldsUpdated: string[];
  error?: string;
}

