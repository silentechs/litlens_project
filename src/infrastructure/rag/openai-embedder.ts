/**
 * OpenAI Embedder Implementation
 * 
 * Concrete implementation using OpenAI's text-embedding-ada-002 model.
 * Implements TextEmbedder interface for dependency injection.
 */

import OpenAI from 'openai';
import type { TextEmbedder } from './ingestion-service';

export class OpenAIEmbedder implements TextEmbedder {
  private readonly client: OpenAI;
  private readonly model = 'text-embedding-ada-002';

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Generate single embedding
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Normalize text (remove excessive newlines)
    const cleanText = this.normalizeText(text);

    const response = await this.client.embeddings.create({
      model: this.model,
      input: cleanText,
    });

    return response.data[0].embedding;
  }

  /**
   * Generate embeddings in batch (more efficient)
   */
  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Normalize all texts
    const cleanTexts = texts.map(t => this.normalizeText(t));

    const response = await this.client.embeddings.create({
      model: this.model,
      input: cleanTexts,
    });

    // Response data is ordered by input index
    return response.data.map(item => item.embedding);
  }

  /**
   * Normalize text for embedding
   */
  private normalizeText(text: string): string {
    return text.replace(/\n/g, ' ').trim();
  }
}

