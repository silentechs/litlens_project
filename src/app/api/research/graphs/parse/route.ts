import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError, success } from "@/lib/api";
import { parseFile } from "@/lib/services/parsers";
import { z } from "zod";

const parseSchema = z.object({
  content: z.string().min(1, "File content is required"),
  filename: z.string().min(1, "Filename is required"),
});

interface GraphNode {
  id: string;
  type: "work" | "author" | "topic" | "journal";
  label: string;
  data: Record<string, unknown>;
  size?: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
}

// POST /api/research/graphs/parse - Parse bibliography and generate citation graph
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const { content, filename } = parseSchema.parse(body);

    // Parse the bibliography file
    const parseResult = await parseFile(content, filename);

    if (parseResult.errors.length > 0 && parseResult.works.length === 0) {
      throw new Error(`Failed to parse file: ${parseResult.errors.join(", ")}`);
    }

    // Build a citation network from the parsed works
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const authorMap = new Map<string, string>(); // author name -> node id
    const journalMap = new Map<string, string>(); // journal name -> node id
    const keywordMap = new Map<string, string>(); // keyword -> node id

    // Create work nodes
    parseResult.works.forEach((work, index) => {
      const workId = `work-${index}`;
      nodes.push({
        id: workId,
        type: "work",
        label: work.title.length > 60 ? work.title.substring(0, 57) + "..." : work.title,
        data: {
          fullTitle: work.title,
          abstract: work.abstract,
          year: work.year,
          doi: work.doi,
          journal: work.journal,
        },
        size: 1,
      });

      // Create author nodes and edges
      if (work.authors && Array.isArray(work.authors)) {
        work.authors.forEach((author) => {
          const authorName = typeof author === "string" ? author : author.name;
          if (!authorName) return;

          let authorId = authorMap.get(authorName);
          if (!authorId) {
            authorId = `author-${authorMap.size}`;
            authorMap.set(authorName, authorId);
            nodes.push({
              id: authorId,
              type: "author",
              label: authorName,
              data: { name: authorName },
              size: 1,
            });
          }

          edges.push({
            id: `edge-${edges.length}`,
            source: authorId,
            target: workId,
            type: "authored",
            weight: 1,
          });

          // Increment author node size
          const authorNode = nodes.find((n) => n.id === authorId);
          if (authorNode) authorNode.size = (authorNode.size || 1) + 0.5;
        });
      }

      // Create journal nodes and edges
      if (work.journal) {
        let journalId = journalMap.get(work.journal);
        if (!journalId) {
          journalId = `journal-${journalMap.size}`;
          journalMap.set(work.journal, journalId);
          nodes.push({
            id: journalId,
            type: "journal",
            label: work.journal.length > 40 ? work.journal.substring(0, 37) + "..." : work.journal,
            data: { name: work.journal },
            size: 1,
          });
        }

        edges.push({
          id: `edge-${edges.length}`,
          source: workId,
          target: journalId,
          type: "published_in",
          weight: 1,
        });

        // Increment journal node size
        const journalNode = nodes.find((n) => n.id === journalId);
        if (journalNode) journalNode.size = (journalNode.size || 1) + 0.5;
      }

      // Create topic/keyword nodes and edges
      if (work.keywords && Array.isArray(work.keywords)) {
        work.keywords.slice(0, 5).forEach((keyword) => {
          const kw = keyword.toLowerCase().trim();
          if (!kw || kw.length < 2) return;

          let keywordId = keywordMap.get(kw);
          if (!keywordId) {
            keywordId = `topic-${keywordMap.size}`;
            keywordMap.set(kw, keywordId);
            nodes.push({
              id: keywordId,
              type: "topic",
              label: kw,
              data: { keyword: kw },
              size: 1,
            });
          }

          edges.push({
            id: `edge-${edges.length}`,
            source: workId,
            target: keywordId,
            type: "has_topic",
            weight: 1,
          });

          // Increment topic node size
          const topicNode = nodes.find((n) => n.id === keywordId);
          if (topicNode) topicNode.size = (topicNode.size || 1) + 0.5;
        });
      }
    });

    // Calculate graph stats
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
    const avgDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0;

    return success({
      nodes,
      edges,
      stats: {
        nodeCount,
        edgeCount,
        density: Math.round(density * 1000) / 1000,
        avgDegree: Math.round(avgDegree * 100) / 100,
      },
      parseInfo: {
        totalWorks: parseResult.works.length,
        uniqueAuthors: authorMap.size,
        uniqueJournals: journalMap.size,
        uniqueTopics: keywordMap.size,
        parseErrors: parseResult.errors.length,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

