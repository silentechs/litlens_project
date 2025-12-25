/**
 * Research Graph Service
 * Handles citation networks, co-authorship, and topic clustering
 */

import { db } from "@/lib/db";
import { GraphType } from "@prisma/client";

// ============== TYPES ==============

export interface GraphNode {
  id: string;
  type: "work" | "author" | "topic" | "journal";
  label: string;
  data: Record<string, unknown>;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "cites" | "cited_by" | "co_author" | "same_topic" | "same_journal";
  weight?: number;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  density: number;
  avgDegree: number;
  clusters?: number;
  centralNodes?: string[];
}

export interface CitationNetwork {
  sourceWork: {
    id: string;
    title: string;
    year: number | null;
  };
  citing: Array<{
    id: string;
    title: string;
    year: number | null;
    citationCount: number | null;
  }>;
  citedBy: Array<{
    id: string;
    title: string;
    year: number | null;
    citationCount: number | null;
  }>;
}

// ============== GRAPH CREATION ==============

/**
 * Build citation network graph for a set of works
 */
export async function buildCitationNetwork(
  workIds: string[],
  options: {
    depth?: number;
    maxNodes?: number;
    includeSecondary?: boolean;
  } = {}
): Promise<GraphData> {
  const { depth = 1, maxNodes = 100, includeSecondary = false } = options;

  const nodes: Map<string, GraphNode> = new Map();
  const edges: GraphEdge[] = [];
  const processedIds = new Set<string>();

  // Get initial works
  const works = await db.work.findMany({
    where: { id: { in: workIds } },
    select: {
      id: true,
      title: true,
      year: true,
      citationCount: true,
      authors: true,
    },
  });

  // Add initial nodes
  works.forEach((work) => {
    nodes.set(work.id, {
      id: work.id,
      type: "work",
      label: truncateTitle(work.title),
      data: {
        title: work.title,
        year: work.year,
        citationCount: work.citationCount,
        authors: work.authors,
        isPrimary: true,
      },
      size: calculateNodeSize(work.citationCount || 0),
      color: "#3B82F6", // Primary color
    });
    processedIds.add(work.id);
  });

  // Build citation links - this would require citation data
  // For now, we'll create a placeholder structure
  // In production, this would query a citation database (e.g., OpenCitations, Semantic Scholar)

  // Compute stats
  const nodeArray = Array.from(nodes.values());
  const stats = computeGraphStats(nodeArray, edges);

  return {
    nodes: nodeArray,
    edges,
    stats,
  };
}

/**
 * Build co-authorship network
 */
export async function buildCoAuthorshipNetwork(
  projectId: string,
  options: {
    minCollaborations?: number;
    maxNodes?: number;
  } = {}
): Promise<GraphData> {
  const { minCollaborations = 1, maxNodes = 200 } = options;

  const nodes: Map<string, GraphNode> = new Map();
  const edgeMap: Map<string, GraphEdge> = new Map();

  // Get all works from the project
  const projectWorks = await db.projectWork.findMany({
    where: { projectId, status: "INCLUDED" },
    include: {
      work: {
        select: { id: true, authors: true, year: true },
      },
    },
  });

  // Build author nodes and collaboration edges
  projectWorks.forEach((pw) => {
    const authors = (pw.work.authors || []) as Array<{ name: string }>;
    
    // Add author nodes
    authors.forEach((author) => {
      const authorId = normalizeAuthorName(author.name);
      if (!nodes.has(authorId)) {
        nodes.set(authorId, {
          id: authorId,
          type: "author",
          label: author.name,
          data: {
            name: author.name,
            paperCount: 1,
          },
          size: 1,
          color: "#10B981",
        });
      } else {
        const node = nodes.get(authorId)!;
        (node.data.paperCount as number)++;
        node.size = Math.sqrt(node.data.paperCount as number) * 2;
      }
    });

    // Add co-authorship edges
    for (let i = 0; i < authors.length; i++) {
      for (let j = i + 1; j < authors.length; j++) {
        const sourceId = normalizeAuthorName(authors[i].name);
        const targetId = normalizeAuthorName(authors[j].name);
        const edgeId = [sourceId, targetId].sort().join("-");

        if (!edgeMap.has(edgeId)) {
          edgeMap.set(edgeId, {
            id: edgeId,
            source: sourceId,
            target: targetId,
            type: "co_author",
            weight: 1,
          });
        } else {
          edgeMap.get(edgeId)!.weight!++;
        }
      }
    }
  });

  // Filter edges by minimum collaborations
  const edges = Array.from(edgeMap.values()).filter(
    (e) => e.weight! >= minCollaborations
  );

  // Limit nodes
  let nodeArray = Array.from(nodes.values());
  if (nodeArray.length > maxNodes) {
    nodeArray.sort((a, b) => (b.data.paperCount as number) - (a.data.paperCount as number));
    nodeArray = nodeArray.slice(0, maxNodes);
    const nodeIds = new Set(nodeArray.map((n) => n.id));
    // Filter edges to only include remaining nodes
    const filteredEdges = edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    return {
      nodes: nodeArray,
      edges: filteredEdges,
      stats: computeGraphStats(nodeArray, filteredEdges),
    };
  }

  return {
    nodes: nodeArray,
    edges,
    stats: computeGraphStats(nodeArray, edges),
  };
}

/**
 * Build topic cluster graph
 */
export async function buildTopicClusterGraph(
  projectId: string,
  options: {
    numTopics?: number;
    minKeywords?: number;
  } = {}
): Promise<GraphData> {
  const { numTopics = 10, minKeywords = 2 } = options;

  const nodes: Map<string, GraphNode> = new Map();
  const edges: GraphEdge[] = [];

  // Get works with keywords
  const projectWorks = await db.projectWork.findMany({
    where: { projectId, status: "INCLUDED" },
    include: {
      work: {
        select: { id: true, title: true, keywords: true },
      },
    },
  });

  // Extract and count keywords
  const keywordCounts: Map<string, number> = new Map();
  const workKeywords: Map<string, string[]> = new Map();

  projectWorks.forEach((pw) => {
    const keywords = (pw.work.keywords || []) as string[];
    workKeywords.set(pw.work.id, keywords);
    
    keywords.forEach((kw) => {
      const normalized = kw.toLowerCase().trim();
      keywordCounts.set(normalized, (keywordCounts.get(normalized) || 0) + 1);
    });
  });

  // Get top keywords as topic nodes
  const topKeywords = Array.from(keywordCounts.entries())
    .filter(([_, count]) => count >= minKeywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, numTopics);

  // Add topic nodes
  topKeywords.forEach(([keyword, count], idx) => {
    nodes.set(keyword, {
      id: keyword,
      type: "topic",
      label: keyword,
      data: { paperCount: count },
      size: Math.sqrt(count) * 3,
      color: getTopicColor(idx),
    });
  });

  // Add work nodes and connect to topics
  const topKeywordSet = new Set(topKeywords.map(([kw]) => kw));
  
  projectWorks.forEach((pw) => {
    const keywords = workKeywords.get(pw.work.id) || [];
    const relevantKeywords = keywords.map((k) => k.toLowerCase().trim()).filter((k) => topKeywordSet.has(k));

    if (relevantKeywords.length > 0) {
      nodes.set(pw.work.id, {
        id: pw.work.id,
        type: "work",
        label: truncateTitle(pw.work.title),
        data: { title: pw.work.title },
        size: 2,
        color: "#6B7280",
      });

      relevantKeywords.forEach((kw) => {
        edges.push({
          id: `${pw.work.id}-${kw}`,
          source: pw.work.id,
          target: kw,
          type: "same_topic",
          weight: 1,
        });
      });
    }
  });

  // Connect topics that share papers
  const topicPapers: Map<string, Set<string>> = new Map();
  edges.forEach((e) => {
    if (e.type === "same_topic") {
      if (!topicPapers.has(e.target)) {
        topicPapers.set(e.target, new Set());
      }
      topicPapers.get(e.target)!.add(e.source);
    }
  });

  const topicList = Array.from(topicPapers.keys());
  for (let i = 0; i < topicList.length; i++) {
    for (let j = i + 1; j < topicList.length; j++) {
      const shared = [...topicPapers.get(topicList[i])!].filter((p) =>
        topicPapers.get(topicList[j])!.has(p)
      ).length;

      if (shared > 0) {
        edges.push({
          id: `topic-${topicList[i]}-${topicList[j]}`,
          source: topicList[i],
          target: topicList[j],
          type: "same_topic",
          weight: shared,
        });
      }
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    stats: computeGraphStats(Array.from(nodes.values()), edges),
  };
}

// ============== GRAPH PERSISTENCE ==============

/**
 * Save graph to database
 */
export async function saveGraph(
  userId: string,
  data: {
    title: string;
    description?: string;
    graphType: GraphType;
    projectId?: string;
    graphData: GraphData;
    settings?: Record<string, unknown>;
  }
): Promise<{ id: string }> {
  const graph = await db.researchGraph.create({
    data: {
      userId,
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      graphType: data.graphType,
      nodes: data.graphData.nodes as unknown as object[],
      edges: data.graphData.edges as unknown as object[],
      settings: (data.settings || {}) as object,
    },
    select: { id: true },
  });

  return graph;
}

/**
 * Get graph by ID
 */
export async function getGraph(graphId: string, userId: string): Promise<GraphData | null> {
  const graph = await db.researchGraph.findFirst({
    where: {
      id: graphId,
      OR: [{ userId }, { isPublic: true }],
    },
  });

  if (!graph) return null;

  return {
    nodes: graph.nodes as unknown as GraphNode[],
    edges: graph.edges as unknown as GraphEdge[],
    stats: computeGraphStats(
      graph.nodes as unknown as GraphNode[],
      graph.edges as unknown as GraphEdge[]
    ),
  };
}

/**
 * Generate share token for a graph
 */
export async function shareGraph(graphId: string, userId: string): Promise<string> {
  const graph = await db.researchGraph.findFirst({
    where: { id: graphId, userId },
  });

  if (!graph) {
    throw new Error("Graph not found");
  }

  const token = generateShareToken();

  await db.researchGraph.update({
    where: { id: graphId },
    data: {
      isPublic: true,
      shareToken: token,
    },
  });

  return token;
}

// ============== HELPERS ==============

function truncateTitle(title: string, maxLength = 50): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + "...";
}

function calculateNodeSize(citationCount: number): number {
  return Math.max(1, Math.log10(citationCount + 1) * 3);
}

function normalizeAuthorName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "_");
}

function getTopicColor(index: number): string {
  const colors = [
    "#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6",
    "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280", "#78716C",
  ];
  return colors[index % colors.length];
}

function computeGraphStats(nodes: GraphNode[], edges: GraphEdge[]): GraphStats {
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  
  // Calculate density: actual edges / possible edges
  const possibleEdges = nodeCount > 1 ? (nodeCount * (nodeCount - 1)) / 2 : 0;
  const density = possibleEdges > 0 ? edgeCount / possibleEdges : 0;
  
  // Calculate average degree
  const degrees: Map<string, number> = new Map();
  nodes.forEach((n) => degrees.set(n.id, 0));
  edges.forEach((e) => {
    degrees.set(e.source, (degrees.get(e.source) || 0) + 1);
    degrees.set(e.target, (degrees.get(e.target) || 0) + 1);
  });
  
  const totalDegree = Array.from(degrees.values()).reduce((a, b) => a + b, 0);
  const avgDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
  
  // Find central nodes (highest degree)
  const sortedByDegree = Array.from(degrees.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  return {
    nodeCount,
    edgeCount,
    density: Math.round(density * 1000) / 1000,
    avgDegree: Math.round(avgDegree * 100) / 100,
    centralNodes: sortedByDegree,
  };
}

function generateShareToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

