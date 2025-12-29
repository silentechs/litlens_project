import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const json = await request.json();
    const { projectWorkId, templateId, data } = json;

    if (!projectWorkId || !templateId || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Upsert extraction data
    // We want to update if it exists for this user/template/work combination
    const extraction = await db.extractionData.upsert({
      where: {
        projectWorkId_templateId_extractorId: {
          projectWorkId,
          templateId,
          extractorId: user.id
        }
      },
      update: {
        data,
        status: "IN_PROGRESS", // Or logic to determine completion
      },
      create: {
        projectId,
        projectWorkId,
        templateId,
        extractorId: user.id,
        data,
        status: "IN_PROGRESS",
      },
    });

    return NextResponse.json(extraction);
  } catch (error) {
    console.error("[EXTRACTION_DATA_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
