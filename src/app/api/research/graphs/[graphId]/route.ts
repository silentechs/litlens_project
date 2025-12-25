import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  success,
  noContent,
} from "@/lib/api";
import { getGraph } from "@/lib/services/research-graph";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ graphId: string }>;
}

const updateGraphSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  nodes: z.array(z.unknown()).optional(),
  edges: z.array(z.unknown()).optional(),
  layoutData: z.unknown().optional(),
  settings: z.record(z.unknown()).optional(),
  filters: z.record(z.unknown()).optional(),
});

// GET /api/research/graphs/[graphId] - Get graph details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { graphId } = await params;

    const graph = await db.researchGraph.findFirst({
      where: {
        id: graphId,
        OR: [
          { userId: session.user.id },
          { isPublic: true },
        ],
      },
    });

    if (!graph) {
      throw new NotFoundError("Graph");
    }

    const graphData = await getGraph(graphId, session.user.id);

    return success({
      id: graph.id,
      title: graph.title,
      description: graph.description,
      graphType: graph.graphType,
      isPublic: graph.isPublic,
      shareToken: graph.shareToken,
      projectId: graph.projectId,
      data: graphData,
      layoutData: graph.layoutData,
      settings: graph.settings,
      filters: graph.filters,
      createdAt: graph.createdAt.toISOString(),
      updatedAt: graph.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/research/graphs/[graphId] - Update graph
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { graphId } = await params;

    // Verify ownership
    const existing = await db.researchGraph.findFirst({
      where: { id: graphId, userId: session.user.id },
    });

    if (!existing) {
      throw new NotFoundError("Graph");
    }

    const body = await request.json();
    const data = updateGraphSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.title) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.nodes) updateData.nodes = data.nodes;
    if (data.edges) updateData.edges = data.edges;
    if (data.layoutData) updateData.layoutData = data.layoutData;
    if (data.settings) updateData.settings = data.settings;
    if (data.filters) updateData.filters = data.filters;

    const graph = await db.researchGraph.update({
      where: { id: graphId },
      data: updateData,
    });

    return success({
      id: graph.id,
      title: graph.title,
      updatedAt: graph.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/research/graphs/[graphId] - Delete graph
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { graphId } = await params;

    // Verify ownership
    const graph = await db.researchGraph.findFirst({
      where: { id: graphId, userId: session.user.id },
    });

    if (!graph) {
      throw new NotFoundError("Graph");
    }

    await db.researchGraph.delete({ where: { id: graphId } });

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

