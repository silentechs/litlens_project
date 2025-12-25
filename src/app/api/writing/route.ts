import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  success,
  created,
} from "@/lib/api";
import {
  createWritingProject,
  getUserWritingProjects,
} from "@/lib/services/writing-projects";
import { z } from "zod";

const createWritingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["LITERATURE_REVIEW", "BACKGROUND", "METHODS", "RESULTS", "DISCUSSION", "ABSTRACT"]),
  projectId: z.string().cuid().optional(),
  citationStyle: z.string().default("APA"),
  targetLength: z.number().positive().optional(),
});

// GET /api/writing - List user's writing projects
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") as "LITERATURE_REVIEW" | "BACKGROUND" | "METHODS" | "RESULTS" | "DISCUSSION" | "ABSTRACT" | null;
    const status = searchParams.get("status") as "DRAFT" | "IN_PROGRESS" | "REVIEW" | "COMPLETE" | null;
    const projectId = searchParams.get("projectId") || undefined;

    const projects = await getUserWritingProjects(session.user.id, {
      type: type || undefined,
      status: status || undefined,
      projectId,
    });

    return success(projects.map((p) => ({
      ...p,
      updatedAt: p.updatedAt.toISOString(),
    })));
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/writing - Create writing project
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const data = createWritingSchema.parse(body);

    const project = await createWritingProject(session.user.id, {
      title: data.title,
      type: data.type,
      projectId: data.projectId,
      citationStyle: data.citationStyle,
      targetLength: data.targetLength,
    });

    return created(project);
  } catch (error) {
    return handleApiError(error);
  }
}

