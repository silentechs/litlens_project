/**
 * Duplicate Detection Service
 * 
 * Identifies potential duplicate studies using multiple matching strategies:
 * 1. Exact DOI match
 * 2. Exact PMID match
 * 3. Title similarity (fuzzy matching)
 * 4. Title + Author + Year combination
 */

import { db } from '@/lib/db';
import { ParsedWork } from './parsers';

export interface DuplicateMatch {
  workId: string;
  matchType: 'doi' | 'pmid' | 'title' | 'title_author_year';
  confidence: number; // 0-1
  matchedWork: {
    id: string;
    title: string;
    doi?: string | null;
    authors?: { name: string }[] | null;
    year?: number | null;
  };
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  existingWorkId?: string;
}

// Configuration
const TITLE_SIMILARITY_THRESHOLD = 0.85;
const TITLE_AUTHOR_YEAR_THRESHOLD = 0.75;

/**
 * Check if a work is a duplicate against existing works in the database
 */
export async function checkDuplicate(
  work: ParsedWork,
  projectId?: string
): Promise<DuplicateCheckResult> {
  const matches: DuplicateMatch[] = [];
  
  // Strategy 1: Exact DOI match (highest confidence)
  if (work.doi) {
    const doiMatch = await findByDOI(work.doi, projectId);
    if (doiMatch) {
      matches.push({
        workId: doiMatch.id,
        matchType: 'doi',
        confidence: 1.0,
        matchedWork: {
          id: doiMatch.id,
          title: doiMatch.title,
          doi: doiMatch.doi,
          authors: doiMatch.authors as { name: string }[] | null,
          year: doiMatch.year,
        },
      });
    }
  }
  
  // Strategy 2: Exact PMID match
  if (work.pmid) {
    const pmidMatch = await findByPMID(work.pmid, projectId);
    if (pmidMatch) {
      matches.push({
        workId: pmidMatch.id,
        matchType: 'pmid',
        confidence: 1.0,
        matchedWork: {
          id: pmidMatch.id,
          title: pmidMatch.title,
          doi: null,
          authors: pmidMatch.authors as { name: string }[] | null,
          year: pmidMatch.year,
        },
      });
    }
  }
  
  // Strategy 3: Title similarity
  if (work.title) {
    const titleMatches = await findByTitleSimilarity(
      work.title,
      projectId,
      TITLE_SIMILARITY_THRESHOLD
    );
    
    for (const match of titleMatches) {
      // Skip if already matched by DOI or PMID
      if (matches.some(m => m.workId === match.id)) continue;
      
      matches.push({
        workId: match.id,
        matchType: 'title',
        confidence: match.similarity,
        matchedWork: match,
      });
    }
  }
  
  // Strategy 4: Title + Author + Year combination
  if (work.title && work.authors?.length > 0 && work.year) {
    const combinedMatches = await findByTitleAuthorYear(
      work.title,
      work.authors[0].name,
      work.year,
      projectId
    );
    
    for (const match of combinedMatches) {
      // Skip if already matched
      if (matches.some(m => m.workId === match.id)) continue;
      
      matches.push({
        workId: match.id,
        matchType: 'title_author_year',
        confidence: match.confidence,
        matchedWork: match,
      });
    }
  }
  
  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence);
  
  return {
    isDuplicate: matches.length > 0,
    matches,
    existingWorkId: matches[0]?.workId,
  };
}

/**
 * Batch check duplicates for multiple works
 */
export async function checkDuplicatesBatch(
  works: ParsedWork[],
  projectId?: string
): Promise<Map<number, DuplicateCheckResult>> {
  const results = new Map<number, DuplicateCheckResult>();
  
  // Collect all DOIs and PMIDs for batch lookup
  const dois = new Set<string>();
  const pmids = new Set<string>();
  
  works.forEach((work, index) => {
    if (work.doi) dois.add(work.doi);
    if (work.pmid) pmids.add(work.pmid);
  });
  
  // Batch fetch existing works by DOI
  const doiMatches = await db.work.findMany({
    where: {
      doi: { in: Array.from(dois) },
      ...(projectId && {
        projectWorks: { some: { projectId } },
      }),
    },
    select: {
      id: true,
      title: true,
      doi: true,
      authors: true,
      year: true,
    },
  });
  
  const doiMap = new Map(doiMatches.map(w => [w.doi, w]));
  
  // Batch fetch existing works by PMID
  const pmidMatches = await db.work.findMany({
    where: {
      pmid: { in: Array.from(pmids) },
      ...(projectId && {
        projectWorks: { some: { projectId } },
      }),
    },
    select: {
      id: true,
      title: true,
      pmid: true,
      authors: true,
      year: true,
    },
  });
  
  const pmidMap = new Map(pmidMatches.map(w => [w.pmid, w]));
  
  // Process each work
  for (let i = 0; i < works.length; i++) {
    const work = works[i];
    const matches: DuplicateMatch[] = [];
    
    // Check DOI
    if (work.doi && doiMap.has(work.doi)) {
      const match = doiMap.get(work.doi)!;
      matches.push({
        workId: match.id,
        matchType: 'doi',
        confidence: 1.0,
        matchedWork: {
          id: match.id,
          title: match.title,
          doi: match.doi,
          authors: match.authors as { name: string }[] | null,
          year: match.year,
        },
      });
    }
    
    // Check PMID
    if (work.pmid && pmidMap.has(work.pmid)) {
      const match = pmidMap.get(work.pmid)!;
      if (!matches.some(m => m.workId === match.id)) {
        matches.push({
          workId: match.id,
          matchType: 'pmid',
          confidence: 1.0,
          matchedWork: {
            id: match.id,
            title: match.title,
            doi: null,
            authors: match.authors as { name: string }[] | null,
            year: match.year,
          },
        });
      }
    }
    
    // For title similarity, we need individual checks (expensive)
    // Only do this if no DOI/PMID match found
    if (matches.length === 0 && work.title) {
      const titleResult = await findByTitleSimilarity(
        work.title,
        projectId,
        TITLE_SIMILARITY_THRESHOLD
      );
      
      for (const match of titleResult) {
        matches.push({
          workId: match.id,
          matchType: 'title',
          confidence: match.similarity,
          matchedWork: match,
        });
      }
    }
    
    matches.sort((a, b) => b.confidence - a.confidence);
    
    results.set(i, {
      isDuplicate: matches.length > 0,
      matches,
      existingWorkId: matches[0]?.workId,
    });
  }
  
  return results;
}

// Helper functions

async function findByDOI(doi: string, projectId?: string) {
  return db.work.findFirst({
    where: {
      doi,
      ...(projectId && {
        projectWorks: { some: { projectId } },
      }),
    },
    select: {
      id: true,
      title: true,
      doi: true,
      authors: true,
      year: true,
    },
  });
}

async function findByPMID(pmid: string, projectId?: string) {
  return db.work.findFirst({
    where: {
      pmid,
      ...(projectId && {
        projectWorks: { some: { projectId } },
      }),
    },
    select: {
      id: true,
      title: true,
      pmid: true,
      authors: true,
      year: true,
    },
  });
}

async function findByTitleSimilarity(
  title: string,
  projectId: string | undefined,
  threshold: number
): Promise<Array<{ id: string; title: string; authors?: { name: string }[] | null; year?: number | null; similarity: number }>> {
  // Normalize the input title
  const normalizedInput = normalizeTitle(title);
  
  // Get potential matches (we'll filter by similarity in memory)
  // For production, consider using pg_trgm or full-text search
  const candidates = await db.work.findMany({
    where: {
      ...(projectId && {
        projectWorks: { some: { projectId } },
      }),
    },
    select: {
      id: true,
      title: true,
      authors: true,
      year: true,
    },
    take: 1000, // Limit for performance
  });
  
  const matches: Array<{ id: string; title: string; authors?: { name: string }[] | null; year?: number | null; similarity: number }> = [];
  
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeTitle(candidate.title);
    const similarity = calculateSimilarity(normalizedInput, normalizedCandidate);
    
    if (similarity >= threshold) {
      matches.push({
        id: candidate.id,
        title: candidate.title,
        authors: candidate.authors as { name: string }[] | null,
        year: candidate.year,
        similarity,
      });
    }
  }
  
  return matches.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
}

async function findByTitleAuthorYear(
  title: string,
  authorName: string,
  year: number,
  projectId?: string
): Promise<Array<{ id: string; title: string; authors?: { name: string }[] | null; year?: number | null; confidence: number }>> {
  const normalizedTitle = normalizeTitle(title);
  const normalizedAuthor = normalizeAuthorName(authorName);
  
  // Find works with same year
  const candidates = await db.work.findMany({
    where: {
      year,
      ...(projectId && {
        projectWorks: { some: { projectId } },
      }),
    },
    select: {
      id: true,
      title: true,
      authors: true,
      year: true,
    },
    take: 500,
  });
  
  const matches: Array<{ id: string; title: string; authors?: { name: string }[] | null; year?: number | null; confidence: number }> = [];
  
  for (const candidate of candidates) {
    const candidateTitle = normalizeTitle(candidate.title);
    const titleSimilarity = calculateSimilarity(normalizedTitle, candidateTitle);
    
    // Check author
    const authors = candidate.authors as { name: string }[] | null;
    let authorMatch = false;
    if (authors && authors.length > 0) {
      for (const author of authors) {
        const candidateAuthor = normalizeAuthorName(author.name);
        if (calculateSimilarity(normalizedAuthor, candidateAuthor) > 0.7) {
          authorMatch = true;
          break;
        }
      }
    }
    
    // Combined confidence
    const confidence = titleSimilarity * (authorMatch ? 1 : 0.5);
    
    if (confidence >= TITLE_AUTHOR_YEAR_THRESHOLD) {
      matches.push({
        id: candidate.id,
        title: candidate.title,
        authors: authors,
        year: candidate.year,
        confidence,
      });
    }
  }
  
  return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

// Text normalization and similarity functions

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .trim();
}

function normalizeAuthorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(part => part.length > 1) // Remove initials
    .join(' ');
}

/**
 * Calculate Jaccard similarity between two strings (word-based)
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  
  // Use word-based Jaccard similarity
  const wordsA = new Set(a.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(b.split(' ').filter(w => w.length > 2));
  
  if (wordsA.size === 0 || wordsB.size === 0) {
    // Fallback to character-based for short strings
    return calculateLevenshteinSimilarity(a, b);
  }
  
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  
  return intersection.size / union.size;
}

/**
 * Calculate Levenshtein-based similarity
 */
function calculateLevenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

