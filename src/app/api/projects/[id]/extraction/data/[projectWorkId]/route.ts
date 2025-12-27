import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

interface RouteParams {
  params: {
    id: string;
    projectWorkId: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, projectWorkId } = params;

    // Get the data for this user
    // In a real scenario we might also fetching valid templates to check against?
    // For now getting the latest data entry for this user

    // We assume we want the data for the current user
    const extraction = await db.extractionData.findFirst({
      where: {
        projectId,
        projectWorkId,
        extractorId: user.id
      },
      include: {
        template: true // Include template to know fields
      }
    });

    return NextResponse.json(extraction || null);
  } catch (error) {
    console.error("[EXTRACTION_DATA_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
