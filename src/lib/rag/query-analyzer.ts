/**
 * Query Analyzer
 * Analyzes user queries to determine the best response strategy
 */

import type { QueryAnalysis, SynthesisMode } from "@/domain/chat/types";

// ============== PATTERN MATCHERS ==============

const COUNT_PATTERNS = [
  /how many/i,
  /number of/i,
  /count of/i,
  /total (studies|papers|articles|records)/i,
];

const TEAM_PATTERNS = [
  /who (is|are|can)/i,
  /reviewers?/i,
  /screeners?/i,
  /team members?/i,
];

const COMPARISON_PATTERNS = [
  /compare/i,
  /contrast/i,
  /differ(ence|s|ent)/i,
  /vs\.?/i,
  /versus/i,
  /similar(ity|ities)?/i,
  /between/i,
];

const GAP_PATTERNS = [
  /gap(s)?/i,
  /missing/i,
  /lack(ing)?/i,
  /need(s|ed)? (more|further)/i,
  /future research/i,
  /limitation(s)?/i,
];

const SYNTHESIS_PATTERNS = [
  /what do (the )?stud(y|ies) (say|show|find|report|suggest)/i,
  /summary of/i,
  /summarize/i,
  /overall (finding|result|conclusion)/i,
  /main (finding|result|conclusion)/i,
  /key (finding|result|conclusion|insight)/i,
  /across (the )?(stud|paper|article)/i,
];

const CLARIFICATION_TRIGGERS = [
  /^(what|which|how)\s*$/i, // Very short ambiguous queries
  /^.{1,10}$/,              // Very short queries (< 10 chars)
];

// ============== ANALYZER ==============

/**
 * Analyze a user query to determine response strategy
 */
export function analyzeQuery(query: string): QueryAnalysis {
  const trimmedQuery = query.trim();
  
  // Check for count questions (deterministic DB answers)
  const isCountQuestion = COUNT_PATTERNS.some(p => p.test(trimmedQuery));
  
  // Check for team questions (deterministic DB answers)
  const isTeamQuestion = TEAM_PATTERNS.some(p => p.test(trimmedQuery));
  
  // Determine synthesis mode
  const synthesisMode = determineSynthesisMode(trimmedQuery);
  
  // Check if clarification needed
  const needsClarification = checkNeedsClarification(trimmedQuery);
  const clarificationPrompt = needsClarification 
    ? generateClarificationPrompt(trimmedQuery) 
    : undefined;
  
  // Extract topics from query
  const extractedTopics = extractTopics(trimmedQuery);
  
  return {
    originalQuery: trimmedQuery,
    synthesisMode,
    isCountQuestion,
    isTeamQuestion,
    needsClarification,
    clarificationPrompt,
    extractedTopics,
  };
}

/**
 * Determine the synthesis mode based on query patterns
 */
function determineSynthesisMode(query: string): SynthesisMode {
  // Check for comparison questions
  if (COMPARISON_PATTERNS.some(p => p.test(query))) {
    return 'comparison';
  }
  
  // Check for gap analysis questions
  if (GAP_PATTERNS.some(p => p.test(query))) {
    return 'gap_analysis';
  }
  
  // Check for synthesis questions
  if (SYNTHESIS_PATTERNS.some(p => p.test(query))) {
    return 'multi_paper';
  }
  
  // Check if query mentions multiple papers/studies
  const multiPaperIndicators = [
    /stud(y|ies)/gi,
    /paper(s)?/gi,
    /article(s)?/gi,
  ];
  
  const mentionCount = multiPaperIndicators.reduce((count, pattern) => {
    const matches = query.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);
  
  if (mentionCount > 1) {
    return 'multi_paper';
  }
  
  return 'single_paper';
}

/**
 * Check if query needs clarification
 */
function checkNeedsClarification(query: string): boolean {
  // Very short queries
  if (query.length < 10) return true;
  
  // Known ambiguous patterns
  if (CLARIFICATION_TRIGGERS.some(p => p.test(query))) return true;
  
  // Single word queries (except common questions)
  const words = query.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 1 && !['help', 'hi', 'hello'].includes(words[0].toLowerCase())) {
    return true;
  }
  
  return false;
}

/**
 * Generate a clarification prompt based on ambiguous query
 */
function generateClarificationPrompt(query: string): string {
  const words = query.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length < 3) {
    return `Could you please provide more details? For example:
- What specific aspect of "${query}" are you interested in?
- Are you asking about findings, methods, or participants?`;
  }
  
  return `Your question seems broad. Could you clarify:
- Which specific studies or time period are you interested in?
- What aspect would you like me to focus on?`;
}

/**
 * Extract key topics from the query
 */
function extractTopics(query: string): string[] {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'of', 'in', 'to', 'for', 'with', 'on', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
    'because', 'until', 'while', 'what', 'which', 'who', 'whom', 'this',
    'that', 'these', 'those', 'am', 'about', 'study', 'studies', 'paper',
    'papers', 'article', 'articles', 'research', 'find', 'findings',
    'show', 'shows', 'report', 'reports', 'suggest', 'suggests',
  ]);
  
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  // Return unique topics
  return [...new Set(words)];
}

/**
 * Generate follow-up question suggestions based on query and results
 */
export function generateSuggestedQuestions(
  originalQuery: string,
  topics: string[],
  synthesisMode: SynthesisMode
): string[] {
  const suggestions: string[] = [];
  
  // Based on synthesis mode, suggest different follow-ups
  switch (synthesisMode) {
    case 'single_paper':
      if (topics.length > 0) {
        suggestions.push(`What are the main findings about ${topics[0]}?`);
        suggestions.push(`How do studies measure ${topics[0]}?`);
      }
      suggestions.push("What are the methodological limitations?");
      break;
      
    case 'multi_paper':
      suggestions.push("How do the findings compare across studies?");
      suggestions.push("What are the key differences in methodology?");
      if (topics.length > 0) {
        suggestions.push(`What is the consensus on ${topics[0]}?`);
      }
      break;
      
    case 'comparison':
      suggestions.push("What factors explain these differences?");
      suggestions.push("Which approach has stronger evidence?");
      suggestions.push("Are there any studies that reconcile these findings?");
      break;
      
    case 'gap_analysis':
      suggestions.push("What methodologies are suggested for future research?");
      suggestions.push("Which gaps are most critical to address?");
      suggestions.push("What populations need more study?");
      break;
  }
  
  // Return up to 3 suggestions
  return suggestions.slice(0, 3);
}

