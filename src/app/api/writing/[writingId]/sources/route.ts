import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  success,
  created,
  noContent,
} from "@/lib/api";
import {
  addCitationSource,
  removeCitationSource,
  generateBibliography,
} from "@/lib/services/writing-projects";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ writingId: string }>;
}

const addSourceSchema = z.object({
  workId: z.string().cuid(),
});

// GET /api/writing/[writingId]/sources/bibliography - Generate bibliography
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { writingId } = await params;

    const bibliography = await generateBibliography(writingId, session.user.id);

    return success({ bibliography });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/writing/[writingId]/sources - Add citation source
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { writingId } = await params;
    const body = await request.json();
    const { workId } = addSourceSchema.parse(body);

    const source = await addCitationSource(writingId, session.user.id, workId);

    return created(source);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/writing/[writingId]/sources - Remove citation source
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { writingId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const sourceId = searchParams.get("sourceId");

    if (!sourceId) {
      throw new Error("sourceId is required");
    }

    await removeCitationSource(writingId, session.user.id, sourceId);

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

