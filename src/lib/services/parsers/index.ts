/**
 * Unified Parser Interface
 * 
 * Auto-detects file format and parses bibliographic data
 */

import { parseRIS, ParsedWork } from './ris-parser';
import { parseBibTeX } from './bibtex-parser';
import { parseCSV, autoDetectAndParseCSV } from './csv-parser';

export type { ParsedWork } from './ris-parser';
export { parseRIS } from './ris-parser';
export { parseBibTeX } from './bibtex-parser';
export { parseCSV, autoDetectAndParseCSV } from './csv-parser';

export type FileFormat = 'ris' | 'bibtex' | 'csv' | 'tsv' | 'txt' | 'unknown';

export interface ParseResult {
  format: FileFormat;
  works: ParsedWork[];
  errors: string[];
  warnings: string[];
  stats: {
    total: number;
    successful: number;
    failed: number;
    duplicates: number;
  };
}

/**
 * Detect file format from content and filename
 */
export function detectFormat(content: string, filename?: string): FileFormat {
  const ext = filename?.toLowerCase().split('.').pop();
  
  // Check by extension first
  if (ext === 'ris') return 'ris';
  if (ext === 'bib' || ext === 'bibtex') return 'bibtex';
  if (ext === 'csv') return 'csv';
  if (ext === 'tsv') return 'tsv';
  if (ext === 'txt') {
    // Analyze content for txt files
    return detectFormatFromContent(content);
  }
  
  // Analyze content
  return detectFormatFromContent(content);
}

function detectFormatFromContent(content: string): FileFormat {
  const trimmed = content.trim();
  
  // Check for RIS format (starts with TY  -)
  if (/^TY\s{2}-/m.test(trimmed)) {
    return 'ris';
  }
  
  // Check for BibTeX format (starts with @type{)
  if (/^@\w+\s*\{/m.test(trimmed)) {
    return 'bibtex';
  }
  
  // Check for CSV/TSV (has header row with common field names)
  const firstLine = trimmed.split(/\r?\n/)[0].toLowerCase();
  if (
    firstLine.includes('title') ||
    firstLine.includes('author') ||
    firstLine.includes('doi') ||
    firstLine.includes('abstract')
  ) {
    if (firstLine.includes('\t')) {
      return 'tsv';
    }
    return 'csv';
  }
  
  return 'unknown';
}

/**
 * Parse bibliographic file content
 */
export function parseFile(content: string, filename?: string): ParseResult {
  const format = detectFormat(content, filename);
  const errors: string[] = [];
  const warnings: string[] = [];
  let works: ParsedWork[] = [];
  
  try {
    switch (format) {
      case 'ris':
        works = parseRIS(content);
        break;
        
      case 'bibtex':
        works = parseBibTeX(content);
        break;
        
      case 'csv':
        works = parseCSV(content, { delimiter: ',' });
        break;
        
      case 'tsv':
        works = parseCSV(content, { delimiter: '\t' });
        break;
        
      case 'txt':
        // Try auto-detection for text files
        works = autoDetectAndParseCSV(content);
        break;
        
      case 'unknown':
        // Try each parser in sequence
        works = parseRIS(content);
        if (works.length === 0) {
          works = parseBibTeX(content);
        }
        if (works.length === 0) {
          works = autoDetectAndParseCSV(content);
        }
        if (works.length === 0) {
          errors.push('Could not determine file format. Please use RIS, BibTeX, or CSV format.');
        }
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parsing error';
    errors.push(`Parsing error: ${message}`);
  }
  
  // Validate and filter works
  const validWorks: ParsedWork[] = [];
  const seenTitles = new Set<string>();
  let duplicates = 0;
  
  for (const work of works) {
    // Skip works without title
    if (!work.title || work.title.trim().length === 0) {
      warnings.push('Skipped record: missing title');
      continue;
    }
    
    // Clean and normalize title
    work.title = work.title.trim();
    
    // Check for duplicates within the file
    const normalizedTitle = work.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenTitles.has(normalizedTitle)) {
      duplicates++;
      warnings.push(`Duplicate within file: "${work.title.substring(0, 50)}..."`);
      continue;
    }
    seenTitles.add(normalizedTitle);
    
    // Validate and clean other fields
    if (work.doi) {
      // Validate DOI format
      if (!/^10\.\d{4,}/.test(work.doi)) {
        work.doi = undefined;
      }
    }
    
    if (work.year) {
      // Validate year range
      if (work.year < 1800 || work.year > new Date().getFullYear() + 1) {
        warnings.push(`Invalid year ${work.year} for "${work.title.substring(0, 30)}..."`);
        work.year = undefined;
      }
    }
    
    validWorks.push(work);
  }
  
  return {
    format,
    works: validWorks,
    errors,
    warnings,
    stats: {
      total: works.length + duplicates,
      successful: validWorks.length,
      failed: works.length - validWorks.length,
      duplicates,
    },
  };
}

/**
 * Parse multiple files
 */
export function parseFiles(
  files: { content: string; filename: string }[]
): ParseResult {
  const allWorks: ParsedWork[] = [];
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  let totalDuplicates = 0;
  let format: FileFormat = 'unknown';
  
  for (const file of files) {
    const result = parseFile(file.content, file.filename);
    
    if (result.format !== 'unknown') {
      format = result.format;
    }
    
    allWorks.push(...result.works);
    allErrors.push(...result.errors.map(e => `${file.filename}: ${e}`));
    allWarnings.push(...result.warnings.map(w => `${file.filename}: ${w}`));
    totalDuplicates += result.stats.duplicates;
  }
  
  // Remove duplicates across files
  const seenTitles = new Set<string>();
  const uniqueWorks: ParsedWork[] = [];
  
  for (const work of allWorks) {
    const normalizedTitle = work.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.add(normalizedTitle);
      uniqueWorks.push(work);
    } else {
      totalDuplicates++;
    }
  }
  
  return {
    format,
    works: uniqueWorks,
    errors: allErrors,
    warnings: allWarnings,
    stats: {
      total: allWorks.length,
      successful: uniqueWorks.length,
      failed: allWorks.length - uniqueWorks.length - totalDuplicates,
      duplicates: totalDuplicates,
    },
  };
}

