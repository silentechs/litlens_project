/**
 * Domain Types for AI Chat
 * Clean architecture - no infrastructure dependencies
 */

// ============== CITATION TYPES ==============

/**
 * Enhanced citation with precise location data
 */
export interface Citation {
  readonly workId: string;
  readonly workTitle: string;
  readonly authors?: string;
  readonly year?: number;
  readonly doi?: string;
  
  // Precise location
  readonly pageNumber?: number;
  readonly section?: string;
  readonly excerpt: string;
  readonly excerptHighlight?: string; // The specific part to highlight
  
  // Quality metrics
  readonly similarity: number;
  readonly chunkIndex?: number;
  
  // For PDF highlighting (optional)
  readonly boundingBox?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============== MESSAGE TYPES ==============

export type MessageRole = 'user' | 'assistant' | 'system';

export type EvidenceQuality = 'strong' | 'moderate' | 'weak' | 'none';

export type FeedbackType = 
  | 'helpful'
  | 'accurate'
  | 'incomplete'
  | 'hallucination'
  | 'wrong_citation'
  | 'off_topic'
  | 'other';

/**
 * Chat message with full metadata
 */
export interface ChatMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: Date;
  
  // Evidence (assistant messages only)
  readonly citations?: Citation[];
  readonly confidence?: number;
  readonly evidenceQuality?: EvidenceQuality;
  readonly sourceCount?: number;
  
  // Follow-up suggestions (assistant messages only)
  readonly suggestedQuestions?: string[];
  
  // User feedback
  readonly feedbackScore?: number;
  readonly feedbackType?: FeedbackType;
  readonly flagged?: boolean;
  
  // Processing metadata
  readonly modelUsed?: string;
  readonly processingTimeMs?: number;
}

/**
 * Conversation with messages
 */
export interface Conversation {
  readonly id: string;
  readonly projectId: string;
  readonly userId: string;
  readonly title?: string;
  readonly summary?: string;
  readonly messageCount: number;
  readonly lastMessageAt?: Date;
  readonly isArchived: boolean;
  readonly isPinned: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly messages?: ChatMessage[];
}

// ============== REQUEST/RESPONSE TYPES ==============

/**
 * Chat request from client
 */
export interface ChatRequest {
  readonly conversationId?: string; // Optional - creates new if not provided
  readonly message: string;
  readonly projectId: string;
}

/**
 * Streaming chat response metadata
 */
export interface ChatResponseMeta {
  readonly conversationId: string;
  readonly messageId: string;
  readonly citations: Citation[];
  readonly confidence: number;
  readonly evidenceQuality: EvidenceQuality;
  readonly sourceCount: number;
  readonly suggestedQuestions: string[];
  readonly processingTimeMs: number;
}

/**
 * Feedback request
 */
export interface FeedbackRequest {
  readonly messageId: string;
  readonly score: 1 | 5; // Thumbs down or up
  readonly type?: FeedbackType;
  readonly comment?: string;
}

/**
 * Flag request
 */
export interface FlagRequest {
  readonly messageId: string;
  readonly reason: string;
}

// ============== RETRIEVAL TYPES ==============

/**
 * Enhanced retrieval result with citation data
 */
export interface RetrievalResult {
  readonly content: string;
  readonly similarity: number;
  readonly workId: string;
  readonly workTitle?: string;
  readonly authors?: string;
  readonly year?: number;
  readonly doi?: string;
  readonly pageNumber?: number;
  readonly section?: string;
  readonly chunkIndex: number;
  readonly totalChunks?: number;
}

/**
 * Synthesis mode for cross-paper analysis
 */
export type SynthesisMode = 
  | 'single_paper'      // Answer from one paper
  | 'multi_paper'       // Synthesize across papers
  | 'comparison'        // Compare findings
  | 'gap_analysis';     // Identify research gaps

/**
 * Query analysis result
 */
export interface QueryAnalysis {
  readonly originalQuery: string;
  readonly synthesisMode: SynthesisMode;
  readonly isCountQuestion: boolean;
  readonly isTeamQuestion: boolean;
  readonly needsClarification: boolean;
  readonly clarificationPrompt?: string;
  readonly extractedTopics: string[];
}

// ============== CONSTANTS ==============

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;
export const HIGH_CONFIDENCE_THRESHOLD = 0.7;
export const MIN_CITATIONS_FOR_STRONG_EVIDENCE = 3;
export const MAX_SUGGESTED_QUESTIONS = 3;

/**
 * Determine evidence quality from retrieval results
 */
export function determineEvidenceQuality(
  results: RetrievalResult[],
  hasPdfSources: boolean
): EvidenceQuality {
  if (results.length === 0) return 'none';
  
  const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;
  const highQualityCount = results.filter(r => r.similarity >= HIGH_CONFIDENCE_THRESHOLD).length;
  
  if (hasPdfSources && highQualityCount >= MIN_CITATIONS_FOR_STRONG_EVIDENCE) {
    return 'strong';
  }
  
  if (hasPdfSources && avgSimilarity >= DEFAULT_CONFIDENCE_THRESHOLD) {
    return 'moderate';
  }
  
  if (avgSimilarity >= DEFAULT_CONFIDENCE_THRESHOLD) {
    return 'weak';
  }
  
  return 'none';
}

/**
 * Calculate overall confidence score
 */
export function calculateConfidence(
  results: RetrievalResult[],
  evidenceQuality: EvidenceQuality
): number {
  if (results.length === 0) return 0;
  
  const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;
  
  // Weight by evidence quality
  const qualityMultiplier = {
    strong: 1.0,
    moderate: 0.8,
    weak: 0.5,
    none: 0.1,
  }[evidenceQuality];
  
  return Math.min(1, avgSimilarity * qualityMultiplier);
}

