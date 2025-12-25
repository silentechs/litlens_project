/**
 * CSV File Parser for bibliographic data
 * 
 * Handles various CSV formats from different databases
 */

import { ParsedWork } from './ris-parser';

// Common column name variations mapped to standard fields
const COLUMN_ALIASES: Record<string, keyof ParsedWork | 'author'> = {
  // Title variations
  'title': 'title',
  'article title': 'title',
  'document title': 'title',
  'paper title': 'title',
  
  // Abstract variations
  'abstract': 'abstract',
  'description': 'abstract',
  'summary': 'abstract',
  
  // Author variations
  'authors': 'authors',
  'author': 'authors',
  'author(s)': 'authors',
  'author names': 'authors',
  'creator': 'authors',
  
  // Year variations
  'year': 'year',
  'publication year': 'year',
  'pub year': 'year',
  'date': 'year',
  'publication date': 'year',
  
  // DOI variations
  'doi': 'doi',
  'digital object identifier': 'doi',
  
  // Journal variations
  'journal': 'journal',
  'source': 'journal',
  'source title': 'journal',
  'publication': 'journal',
  'journal name': 'journal',
  'journal/book': 'journal',
  
  // Volume
  'volume': 'volume',
  'vol': 'volume',
  
  // Issue
  'issue': 'issue',
  'number': 'issue',
  'no': 'issue',
  
  // Pages
  'pages': 'pages',
  'page': 'pages',
  'start page': 'pages',
  
  // Keywords
  'keywords': 'keywords',
  'keyword': 'keywords',
  'index keywords': 'keywords',
  'author keywords': 'keywords',
  'mesh terms': 'keywords',
  
  // URL
  'url': 'url',
  'link': 'url',
  'web address': 'url',
  
  // PMID
  'pmid': 'pmid',
  'pubmed id': 'pmid',
  'pubmed': 'pmid',
  
  // Type
  'type': 'publicationType',
  'document type': 'publicationType',
  'publication type': 'publicationType',
  
  // ID
  'id': 'sourceId',
  'accession number': 'sourceId',
  'record id': 'sourceId',
};

export interface CSVParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: string;
}

export function parseCSV(content: string, options: CSVParseOptions = {}): ParsedWork[] {
  const { delimiter = ',', hasHeader = true } = options;
  
  const lines = parseCSVLines(content, delimiter);
  
  if (lines.length === 0) {
    return [];
  }
  
  // Get header row
  const headerRow = hasHeader ? lines[0] : generateDefaultHeaders(lines[0].length);
  const dataRows = hasHeader ? lines.slice(1) : lines;
  
  // Map headers to field names
  const fieldMapping = mapHeaders(headerRow);
  
  // Parse each row
  const works: ParsedWork[] = [];
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const work = parseRow(row, fieldMapping, headerRow);
    
    if (work && work.title) {
      works.push(work);
    }
  }
  
  return works;
}

function parseCSVLines(content: string, delimiter: string): string[][] {
  const lines: string[][] = [];
  const rows = content.split(/\r?\n/);
  
  for (const row of rows) {
    if (!row.trim()) continue;
    
    const fields: string[] = [];
    let field = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      const nextChar = row[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          field += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        fields.push(field.trim());
        field = '';
      } else {
        field += char;
      }
    }
    
    // Add last field
    fields.push(field.trim());
    lines.push(fields);
  }
  
  return lines;
}

function generateDefaultHeaders(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `column_${i + 1}`);
}

function mapHeaders(headers: string[]): Map<number, keyof ParsedWork | 'author'> {
  const mapping = new Map<number, keyof ParsedWork | 'author'>();
  
  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();
    const field = COLUMN_ALIASES[normalizedHeader];
    
    if (field) {
      mapping.set(index, field);
    }
  });
  
  return mapping;
}

function parseRow(
  row: string[],
  fieldMapping: Map<number, keyof ParsedWork | 'author'>,
  headers: string[]
): ParsedWork | null {
  const work: ParsedWork = {
    title: '',
    authors: [],
    rawData: {},
  };
  
  // Store all raw data
  headers.forEach((header, index) => {
    if (row[index]) {
      work.rawData![header] = row[index];
    }
  });
  
  // Map fields
  fieldMapping.forEach((field, index) => {
    const value = row[index]?.trim();
    if (!value) return;
    
    switch (field) {
      case 'title':
        work.title = value;
        break;
        
      case 'abstract':
        work.abstract = value;
        break;
        
      case 'authors':
        work.authors = parseAuthorsString(value);
        break;
        
      case 'year':
        const yearMatch = value.match(/(\d{4})/);
        if (yearMatch) {
          work.year = parseInt(yearMatch[1], 10);
        }
        break;
        
      case 'doi':
        work.doi = value.replace(/^https?:\/\/doi\.org\//, '');
        break;
        
      case 'journal':
        work.journal = value;
        break;
        
      case 'volume':
        work.volume = value;
        break;
        
      case 'issue':
        work.issue = value;
        break;
        
      case 'pages':
        work.pages = value;
        break;
        
      case 'keywords':
        work.keywords = value
          .split(/[,;]/)
          .map(k => k.trim())
          .filter(k => k.length > 0);
        break;
        
      case 'url':
        work.url = value;
        break;
        
      case 'pmid':
        if (/^\d+$/.test(value)) {
          work.pmid = value;
        }
        break;
        
      case 'publicationType':
        work.publicationType = value;
        break;
        
      case 'sourceId':
        work.sourceId = value;
        break;
    }
  });
  
  return work;
}

function parseAuthorsString(authorsStr: string): { name: string }[] {
  // Try different separators
  let authors: string[];
  
  if (authorsStr.includes(';')) {
    authors = authorsStr.split(';');
  } else if (authorsStr.includes(' and ')) {
    authors = authorsStr.split(/\s+and\s+/i);
  } else if (authorsStr.includes(',') && authorsStr.match(/,.*,/)) {
    // Multiple commas might indicate "Last, First; Last, First" or "Author1, Author2"
    // Check if pattern matches "Last, First"
    if (authorsStr.match(/^[^,]+,\s*[^,]+$/)) {
      // Single author in "Last, First" format
      authors = [authorsStr];
    } else {
      // Likely comma-separated authors
      authors = authorsStr.split(/,(?=[^,]+$)|,\s*(?=[A-Z])/);
    }
  } else {
    authors = [authorsStr];
  }
  
  return authors
    .map(a => a.trim())
    .filter(a => a.length > 0)
    .map(name => {
      // Normalize "Last, First" to "First Last"
      if (name.includes(',')) {
        const [last, first] = name.split(',').map(s => s.trim());
        if (first && last) {
          return { name: `${first} ${last}` };
        }
      }
      return { name };
    });
}

// Auto-detect format and parse
export function autoDetectAndParseCSV(content: string): ParsedWork[] {
  // Try to detect delimiter
  const firstLine = content.split(/\r?\n/)[0] || '';
  
  let delimiter = ',';
  if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if (firstLine.includes(';') && !firstLine.includes(',')) {
    delimiter = ';';
  }
  
  return parseCSV(content, { delimiter });
}

