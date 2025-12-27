import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

    const templates = await db.extractionTemplate.findMany({
      where: {
        projectId,
        isActive: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("[EXTRACTION_TEMPLATES_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;
    const json = await request.json();

    // Basic validation
    if (!json.name || !json.fields) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check permissions (Ensure user is project member)
    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } }
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create the template
    const template = await db.extractionTemplate.create({
      data: {
        projectId,
        name: json.name,
        description: json.description,
        fields: json.fields, // JSON array of field definitions
        isActive: true,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("[EXTRACTION_TEMPLATES_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
