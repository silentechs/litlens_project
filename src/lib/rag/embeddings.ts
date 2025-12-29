import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Embedding model configuration
 * Using text-embedding-3-large for better retrieval accuracy
 * Dimension reduced to 1536 for compatibility with existing vectors
 */
const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMENSIONS = 1536; // Reduced from 3072 for backward compatibility

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    // Normalize text to remove newlines which can affect performance
    const cleanText = text.replace(/\n/g, " ").trim();
    
    if (!cleanText) {
        throw new Error("Cannot generate embedding for empty text");
    }

    const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: cleanText,
        dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than calling generateEmbedding multiple times
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    
    // Normalize all texts
    const cleanTexts = texts.map(t => t.replace(/\n/g, " ").trim()).filter(t => t.length > 0);
    
    if (cleanTexts.length === 0) {
        throw new Error("No valid texts to embed");
    }

    const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: cleanTexts,
        dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data.map(d => d.embedding);
}

/**
 * Get embedding model info
 */
export function getEmbeddingModelInfo() {
    return {
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
    };
}
