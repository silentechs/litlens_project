import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[]> {
    // Normalize text to remove newlines which can affect performance
    const cleanText = text.replace(/\n/g, " ");

    const response = await openai.embeddings.create({
        model: "text-embedding-ada-002", // 1536 dimensions
        input: cleanText,
    });

    return response.data[0].embedding;
}
