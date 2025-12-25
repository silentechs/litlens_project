import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  success,
  created,
  paginated,
  buildPaginationArgs,
} from "@/lib/api";
import {
  buildCitationNetwork,
  buildCoAuthorshipNetwork,
  buildTopicClusterGraph,
  saveGraph,
} from "@/lib/services/research-graph";
import { GraphType } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "@/lib/validators";

const createGraphSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  // Accept both UI-friendly names and Prisma enum names
  graphType: z.enum([
    "CITATION_NETWORK", 
    "CO_AUTHORSHIP", "AUTHOR_COLLABORATION",
    "TOPIC_CLUSTER", "CONCEPT_CLUSTER",
    "TEMPORAL_EVOLUTION",
    "CUSTOM"
  ]),
  projectId: z.string().cuid().optional(),
  workIds: z.array(z.string().cuid()).optional(),
  options: z.object({
    depth: z.number().min(1).max(3).optional(),
    maxNodes: z.number().min(10).max(500).optional(),
    includeSecondary: z.boolean().optional(),
    minCollaborations: z.number().optional(),
    numTopics: z.number().optional(),
  }).optional(),
});

// Map UI graph types to Prisma enum values
function mapGraphType(uiType: string): GraphType {
  const mapping: Record<string, GraphType> = {
    "CITATION_NETWORK": GraphType.CITATION_NETWORK,
    "CO_AUTHORSHIP": GraphType.AUTHOR_COLLABORATION,
    "AUTHOR_COLLABORATION": GraphType.AUTHOR_COLLABORATION,
    "TOPIC_CLUSTER": GraphType.CONCEPT_CLUSTER,
    "CONCEPT_CLUSTER": GraphType.CONCEPT_CLUSTER,
    "TEMPORAL_EVOLUTION": GraphType.TEMPORAL_EVOLUTION,
  };
  return mapping[uiType] || GraphType.CONCEPT_CLUSTER;
}

// GET /api/research/graphs - List user's graphs
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const searchParams = request.nextUrl.searchParams;
    const pagination = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const projectId = searchParams.get("projectId");
    const graphType = searchParams.get("type");

    const where: Record<string, unknown> = { userId: session.user.id };
    if (projectId) where.projectId = projectId;
    if (graphType) where.graphType = graphType;

    const [total, graphs] = await Promise.all([
      db.researchGraph.count({ where }),
      db.researchGraph.findMany({
        where,
        ...buildPaginationArgs(pagination.page, pagination.limit),
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          graphType: true,
          isPublic: true,
          shareToken: true,
          createdAt: true,
          updatedAt: true,
          // project relation not included
        },
      }),
    ]);

    return paginated(
      graphs.map((g) => ({
        ...g,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      })),
      total,
      pagination.page,
      pagination.limit
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/research/graphs - Create/generate a graph
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const { title, description, graphType, projectId, workIds, options } = createGraphSchema.parse(body);

    // Generate graph data based on type
    let graphData;
    switch (graphType) {
      case "CITATION_NETWORK":
        if (!workIds || workIds.length === 0) {
          throw new Error("workIds required for citation network");
        }
        graphData = await buildCitationNetwork(workIds, options);
        break;

      case "CO_AUTHORSHIP":
      case "AUTHOR_COLLABORATION":
        if (!projectId) {
          throw new Error("projectId required for co-authorship network");
        }
        // Verify project access
        const membership = await db.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId,
              userId: session.user.id,
            },
          },
        });
        if (!membership) {
          throw new NotFoundError("Project");
        }
        graphData = await buildCoAuthorshipNetwork(projectId, options);
        break;

      case "TOPIC_CLUSTER":
      case "CONCEPT_CLUSTER":
        if (!projectId) {
          throw new Error("projectId required for topic cluster graph");
        }
        graphData = await buildTopicClusterGraph(projectId, options);
        break;

      default:
        graphData = { nodes: [], edges: [], stats: { nodeCount: 0, edgeCount: 0, density: 0, avgDegree: 0 } };
    }

    // Save graph - map UI type to Prisma enum
    const graph = await saveGraph(session.user.id, {
      title,
      description,
      graphType: mapGraphType(graphType),
      projectId,
      graphData,
      settings: options,
    });

    return created(graph);
  } catch (error) {
    return handleApiError(error);
  }
}

