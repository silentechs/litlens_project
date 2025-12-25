import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
    handleApiError,
    UnauthorizedError,
    NotFoundError,
    ValidationError,
} from "@/lib/api";
import {
    exportProjectStudies,
    generatePRISMAData,
    type ExportFormat
} from "@/lib/services/export-service";
import { z } from "zod";

interface RouteParams {
    params: Promise<{ id: string }>;
}

const exportSchema = z.object({
    format: z.enum(["csv", "excel", "ris", "json"]),
    includeScreeningData: z.boolean().optional().default(true),
    includeExtractionData: z.boolean().optional().default(true),
    includeQualityAssessments: z.boolean().optional().default(true),
    studyFilter: z.enum(["all", "included", "excluded", "pending"]).optional().default("all"),
});

// GET /api/projects/[id]/export - Export project studies
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId } = await params;

        // Check project access
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

        // Parse query params
        const searchParams = request.nextUrl.searchParams;
        const format = searchParams.get("format") || "csv";
        const includeScreeningData = searchParams.get("includeScreeningData") !== "false";
        const includeExtractionData = searchParams.get("includeExtractionData") !== "false";
        const includeQualityAssessments = searchParams.get("includeQualityAssessments") !== "false";
        const studyFilter = searchParams.get("studyFilter") || "all";

        const validated = exportSchema.parse({
            format,
            includeScreeningData,
            includeExtractionData,
            includeQualityAssessments,
            studyFilter,
        });

        // Generate export
        const result = await exportProjectStudies({
            ...validated,
            projectId,
            format: validated.format as ExportFormat,
        });

        // Log activity
        await db.activity.create({
            data: {
                userId: session.user.id,
                projectId,
                type: "PROJECT_UPDATED",
                description: `Exported project data as ${format.toUpperCase()}`,
                metadata: {
                    action: "export",
                    format,
                    studyFilter,
                },
            },
        });

        // Return file download response
        const body = typeof result.data === 'string'
            ? result.data
            : new Uint8Array(result.data);

        return new Response(body, {
            headers: {
                "Content-Type": result.contentType,
                "Content-Disposition": `attachment; filename="${result.filename}"`,
                "Cache-Control": "no-cache",
            },
        });
    } catch (error) {
        return handleApiError(error);
    }
}

// POST /api/projects/[id]/export - Get PRISMA flow diagram data
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const { id: projectId } = await params;

        // Check project access
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

        const body = await request.json() as { type?: string };

        if (body.type === "prisma") {
            const prismaData = await generatePRISMAData(projectId);

            return Response.json({
                success: true,
                data: prismaData,
            });
        }

        throw new ValidationError("Invalid export type");
    } catch (error) {
        return handleApiError(error);
    }
}
