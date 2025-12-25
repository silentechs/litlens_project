/**
 * BibTeX File Parser
 * 
 * Parses BibTeX format used by citation managers
 */

import { ParsedWork } from './ris-parser';

// BibTeX field to ParsedWork mapping
const BIBTEX_FIELD_MAP: Record<string, keyof ParsedWork | 'pages'> = {
  'title': 'title',
  'abstract': 'abstract',
  'author': 'authors',
  'year': 'year',
  'doi': 'doi',
  'journal': 'journal',
  'booktitle': 'journal',
  'volume': 'volume',
  'number': 'issue',
  'pages': 'pages',
  'keywords': 'keywords',
  'url': 'url',
  'pmid': 'pmid',
};

// BibTeX entry types
const BIBTEX_TYPES: Record<string, string> = {
  'article': 'Journal Article',
  'book': 'Book',
  'inbook': 'Book Chapter',
  'incollection': 'Book Chapter',
  'inproceedings': 'Conference Paper',
  'conference': 'Conference Paper',
  'mastersthesis': 'Master\'s Thesis',
  'phdthesis': 'PhD Thesis',
  'techreport': 'Technical Report',
  'misc': 'Miscellaneous',
  'unpublished': 'Unpublished Work',
};

export function parseBibTeX(content: string): ParsedWork[] {
  const works: ParsedWork[] = [];
  
  // Match entries: @type{key, ...}
  // Use a more robust regex that handles nested braces
  const entries = extractBibTeXEntries(content);
  
  for (const entry of entries) {
    const work = parseEntry(entry);
    if (work && work.title) {
      works.push(work);
    }
  }
  
  return works;
}

function extractBibTeXEntries(content: string): { type: string; key: string; fields: string }[] {
  const entries: { type: string; key: string; fields: string }[] = [];
  
  // Find all @ symbols that start entries
  const entryPattern = /@(\w+)\s*\{\s*([^,]*?)\s*,/g;
  let match;
  
  while ((match = entryPattern.exec(content)) !== null) {
    const type = match[1].toLowerCase();
    const key = match[2].trim();
    const startIndex = match.index + match[0].length;
    
    // Find the matching closing brace
    let braceCount = 1;
    let endIndex = startIndex;
    
    while (braceCount > 0 && endIndex < content.length) {
      const char = content[endIndex];
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      endIndex++;
    }
    
    if (braceCount === 0) {
      const fields = content.substring(startIndex, endIndex - 1);
      entries.push({ type, key, fields });
    }
  }
  
  return entries;
}

function parseEntry(entry: { type: string; key: string; fields: string }): ParsedWork | null {
  // Skip comment and preamble entries
  if (['comment', 'preamble', 'string'].includes(entry.type)) {
    return null;
  }
  
  const work: ParsedWork = {
    title: '',
    authors: [],
    sourceId: entry.key,
    publicationType: BIBTEX_TYPES[entry.type] || entry.type,
    rawData: { _type: entry.type, _key: entry.key },
  };
  
  // Parse fields
  const fields = parseFields(entry.fields);
  
  // Title
  if (fields.title) {
    work.title = cleanBibTeXValue(fields.title);
  }
  
  // Abstract
  if (fields.abstract) {
    work.abstract = cleanBibTeXValue(fields.abstract);
  }
  
  // Authors
  if (fields.author) {
    work.authors = parseAuthors(fields.author);
  }
  
  // Year
  if (fields.year) {
    const yearStr = cleanBibTeXValue(fields.year);
    const yearMatch = yearStr.match(/(\d{4})/);
    if (yearMatch) {
      work.year = parseInt(yearMatch[1], 10);
    }
  }
  
  // DOI
  if (fields.doi) {
    work.doi = cleanBibTeXValue(fields.doi).replace(/^https?:\/\/doi\.org\//, '');
  }
  
  // Journal
  if (fields.journal) {
    work.journal = cleanBibTeXValue(fields.journal);
  } else if (fields.booktitle) {
    work.journal = cleanBibTeXValue(fields.booktitle);
  }
  
  // Volume
  if (fields.volume) {
    work.volume = cleanBibTeXValue(fields.volume);
  }
  
  // Issue
  if (fields.number) {
    work.issue = cleanBibTeXValue(fields.number);
  }
  
  // Pages
  if (fields.pages) {
    work.pages = cleanBibTeXValue(fields.pages).replace('--', '-');
  }
  
  // Keywords
  if (fields.keywords) {
    work.keywords = cleanBibTeXValue(fields.keywords)
      .split(/[,;]/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
  }
  
  // URL
  if (fields.url) {
    work.url = cleanBibTeXValue(fields.url);
  }
  
  // PMID
  if (fields.pmid) {
    work.pmid = cleanBibTeXValue(fields.pmid);
  }
  
  // Store raw data
  work.rawData = { ...work.rawData, ...fields };
  
  return work;
}

function parseFields(fieldsStr: string): Record<string, string> {
  const fields: Record<string, string> = {};
  
  // Match field = value patterns
  // Handle both {value} and "value" formats
  let remaining = fieldsStr.trim();
  
  while (remaining.length > 0) {
    // Match field name
    const fieldMatch = remaining.match(/^\s*(\w+)\s*=\s*/);
    if (!fieldMatch) {
      // Skip to next comma or end
      const commaIndex = remaining.indexOf(',');
      if (commaIndex === -1) break;
      remaining = remaining.substring(commaIndex + 1);
      continue;
    }
    
    const fieldName = fieldMatch[1].toLowerCase();
    remaining = remaining.substring(fieldMatch[0].length);
    
    // Extract value (handle braces, quotes, and bare values)
    const { value, rest } = extractValue(remaining);
    fields[fieldName] = value;
    remaining = rest;
    
    // Skip comma if present
    const commaMatch = remaining.match(/^\s*,?\s*/);
    if (commaMatch) {
      remaining = remaining.substring(commaMatch[0].length);
    }
  }
  
  return fields;
}

function extractValue(str: string): { value: string; rest: string } {
  const trimmed = str.trimStart();
  
  if (trimmed.startsWith('{')) {
    // Brace-delimited value
    let braceCount = 1;
    let i = 1;
    while (braceCount > 0 && i < trimmed.length) {
      if (trimmed[i] === '{' && trimmed[i - 1] !== '\\') braceCount++;
      else if (trimmed[i] === '}' && trimmed[i - 1] !== '\\') braceCount--;
      i++;
    }
    return {
      value: trimmed.substring(1, i - 1),
      rest: trimmed.substring(i),
    };
  } else if (trimmed.startsWith('"')) {
    // Quote-delimited value
    let i = 1;
    while (i < trimmed.length && (trimmed[i] !== '"' || trimmed[i - 1] === '\\')) {
      i++;
    }
    return {
      value: trimmed.substring(1, i),
      rest: trimmed.substring(i + 1),
    };
  } else {
    // Bare value (number or string constant)
    const match = trimmed.match(/^(\w+)/);
    if (match) {
      return {
        value: match[1],
        rest: trimmed.substring(match[0].length),
      };
    }
    return { value: '', rest: trimmed };
  }
}

function parseAuthors(authorStr: string): { name: string }[] {
  // Authors are separated by " and "
  return cleanBibTeXValue(authorStr)
    .split(/\s+and\s+/i)
    .map(author => ({
      name: normalizeAuthorName(author.trim()),
    }))
    .filter(a => a.name.length > 0);
}

function normalizeAuthorName(name: string): string {
  // Handle "Last, First" format
  if (name.includes(',')) {
    const parts = name.split(',').map(s => s.trim());
    if (parts.length >= 2) {
      return `${parts[1]} ${parts[0]}`;
    }
  }
  return name;
}

function cleanBibTeXValue(value: string): string {
  return value
    // Remove LaTeX commands
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    .replace(/\{([^}]*)\}/g, '$1')
    // Remove extra braces
    .replace(/\{|\}/g, '')
    // Handle common LaTeX characters
    .replace(/\\&/g, '&')
    .replace(/\\\$/g, '$')
    .replace(/\\%/g, '%')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/\\~/g, '~')
    .replace(/\\textasciitilde/g, '~')
    .replace(/--/g, '–')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

