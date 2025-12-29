import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { generateEmbedding } from "./embeddings";

export interface RetrievedChunk {
    content: string;
    metadata: any;
    similarity: number;
}

export async function searchProjectKnowledge(
    projectId: string, // Access control
    query: string,
    options?: {
        limit?: number;
        onlyIncluded?: boolean;
    }
): Promise<RetrievedChunk[]> {
    const limit = options?.limit ?? 5;
    const onlyIncluded = options?.onlyIncluded ?? true;

    const embedding = await generateEmbedding(query);
    const vectorString = `[${embedding.join(",")}]`;

    // We need to join DocumentChunk -> Work -> ProjectWork -> Project
    // Or just DocumentChunk -> Work -> ProjectWork (where projectId matches)

    /*
      QUERY:
      Find chunks where work belongs to the project AND sort by cosine distance.
    */

    const results = await db.$queryRaw<Array<{ content: string; metadata: any; similarity: number }>>`
    SELECT 
      chunk."content",
      chunk."metadata",
      1 - (chunk."embedding" <=> ${vectorString}::vector) as similarity
    FROM "DocumentChunk" chunk
    JOIN "Work" work ON chunk."workId" = work."id"
    JOIN "ProjectWork" pw ON work."id" = pw."workId"
    WHERE pw."projectId" = ${projectId}
      ${onlyIncluded ? Prisma.sql`AND pw."finalDecision" = 'INCLUDE'` : Prisma.empty}
    ORDER BY chunk."embedding" <=> ${vectorString}::vector
    LIMIT ${limit};
  `;

    return results;
}
