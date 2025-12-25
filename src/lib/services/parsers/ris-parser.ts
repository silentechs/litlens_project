/**
 * RIS (Research Information Systems) File Parser
 * 
 * RIS format reference: https://en.wikipedia.org/wiki/RIS_(file_format)
 */

export interface ParsedWork {
  title: string;
  abstract?: string;
  authors: { name: string }[];
  year?: number;
  doi?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  keywords?: string[];
  url?: string;
  pmid?: string;
  publicationType?: string;
  sourceId?: string;
  rawData?: Record<string, string | string[]>;
}

// RIS tag to field mapping
const RIS_TAG_MAP: Record<string, keyof ParsedWork | 'author' | 'keyword'> = {
  'TI': 'title',
  'T1': 'title',
  'AB': 'abstract',
  'N2': 'abstract',
  'AU': 'author',
  'A1': 'author',
  'PY': 'year',
  'Y1': 'year',
  'DA': 'year',
  'DO': 'doi',
  'JO': 'journal',
  'JF': 'journal',
  'T2': 'journal',
  'VL': 'volume',
  'IS': 'issue',
  'SP': 'pages',
  'EP': 'pages', // End page, will be combined
  'KW': 'keyword',
  'UR': 'url',
  'AN': 'pmid', // Accession number (often PMID)
  'TY': 'publicationType',
  'ID': 'sourceId',
};

// RIS type abbreviations
const RIS_TYPES: Record<string, string> = {
  'JOUR': 'Journal Article',
  'BOOK': 'Book',
  'CHAP': 'Book Chapter',
  'CONF': 'Conference Paper',
  'THES': 'Thesis',
  'RPRT': 'Report',
  'ELEC': 'Electronic Resource',
  'GEN': 'Generic',
  'MGZN': 'Magazine Article',
  'NEWS': 'Newspaper Article',
  'UNPB': 'Unpublished Work',
};

export function parseRIS(content: string): ParsedWork[] {
  const works: ParsedWork[] = [];
  const lines = content.split(/\r?\n/);
  
  let currentRecord: Record<string, string | string[]> = {};
  let currentTag = '';
  let startPage = '';
  let endPage = '';

  for (const line of lines) {
    // Check for tag pattern: XX  - value
    const tagMatch = line.match(/^([A-Z0-9]{2})\s{2}-\s*(.*)$/);
    
    if (tagMatch) {
      currentTag = tagMatch[1];
      const value = tagMatch[2].trim();
      
      if (currentTag === 'TY') {
        // Start of new record
        currentRecord = { TY: value };
        startPage = '';
        endPage = '';
      } else if (currentTag === 'ER') {
        // End of record, process it
        if (Object.keys(currentRecord).length > 0) {
          const work = convertToWork(currentRecord, startPage, endPage);
          if (work.title) {
            works.push(work);
          }
        }
        currentRecord = {};
        startPage = '';
        endPage = '';
      } else if (value) {
        // Handle page numbers specially
        if (currentTag === 'SP') {
          startPage = value;
        } else if (currentTag === 'EP') {
          endPage = value;
        }
        
        // Handle multi-value tags (authors, keywords)
        if (['AU', 'A1', 'KW'].includes(currentTag)) {
          if (!currentRecord[currentTag]) {
            currentRecord[currentTag] = [];
          }
          (currentRecord[currentTag] as string[]).push(value);
        } else {
          currentRecord[currentTag] = value;
        }
      }
    } else if (line.trim() && currentTag) {
      // Continuation of previous tag value
      const existing = currentRecord[currentTag];
      if (typeof existing === 'string') {
        currentRecord[currentTag] = existing + ' ' + line.trim();
      }
    }
  }
  
  // Process last record if no ER tag
  if (Object.keys(currentRecord).length > 0) {
    const work = convertToWork(currentRecord, startPage, endPage);
    if (work.title) {
      works.push(work);
    }
  }
  
  return works;
}

function convertToWork(
  record: Record<string, string | string[]>,
  startPage: string,
  endPage: string
): ParsedWork {
  const work: ParsedWork = {
    title: '',
    authors: [],
    rawData: record,
  };
  
  // Title
  work.title = getStringValue(record, ['TI', 'T1']) || '';
  
  // Abstract
  work.abstract = getStringValue(record, ['AB', 'N2']);
  
  // Authors
  const authorFields = ['AU', 'A1'];
  for (const field of authorFields) {
    const authors = record[field];
    if (Array.isArray(authors)) {
      work.authors = authors.map(name => ({ name: normalizeAuthorName(name) }));
      break;
    }
  }
  
  // Year
  const yearStr = getStringValue(record, ['PY', 'Y1', 'DA']);
  if (yearStr) {
    const yearMatch = yearStr.match(/(\d{4})/);
    if (yearMatch) {
      work.year = parseInt(yearMatch[1], 10);
    }
  }
  
  // DOI
  const doi = getStringValue(record, ['DO']);
  if (doi) {
    // Clean DOI - remove URL prefix if present
    work.doi = doi.replace(/^https?:\/\/doi\.org\//, '').trim();
  }
  
  // Journal
  work.journal = getStringValue(record, ['JO', 'JF', 'T2']);
  
  // Volume and Issue
  work.volume = getStringValue(record, ['VL']);
  work.issue = getStringValue(record, ['IS']);
  
  // Pages
  if (startPage && endPage) {
    work.pages = `${startPage}-${endPage}`;
  } else if (startPage) {
    work.pages = startPage;
  }
  
  // Keywords
  const keywords = record['KW'];
  if (Array.isArray(keywords)) {
    work.keywords = keywords;
  }
  
  // URL
  work.url = getStringValue(record, ['UR']);
  
  // PMID
  const pmid = getStringValue(record, ['AN']);
  if (pmid && /^\d+$/.test(pmid)) {
    work.pmid = pmid;
  }
  
  // Publication type
  const type = getStringValue(record, ['TY']);
  if (type) {
    work.publicationType = RIS_TYPES[type] || type;
  }
  
  // Source ID
  work.sourceId = getStringValue(record, ['ID']);
  
  return work;
}

function getStringValue(record: Record<string, string | string[]>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeAuthorName(name: string): string {
  // Handle "Last, First" format
  if (name.includes(',')) {
    const [last, first] = name.split(',').map(s => s.trim());
    if (first && last) {
      return `${first} ${last}`;
    }
  }
  return name.trim();
}

