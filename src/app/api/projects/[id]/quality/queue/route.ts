import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: projectId } = await params;

        // Verify project access
        const projectMember = await db.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: user.id,
                },
            },
        });

        if (!projectMember) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Fetch studies ready for quality assessment (INCLUDED status)
        // Usually happens after or parallel to extraction.
        const works = await db.projectWork.findMany({
            where: {
                projectId,
                status: "INCLUDED",
            },
            include: {
                work: true,
                qualityAssessments: {
                    where: {
                        projectId
                    },
                    include: {
                        assessor: {
                            select: { name: true, image: true }
                        },
                        tool: {
                            select: { name: true }
                        }
                    }
                }
            },
            orderBy: {
                updatedAt: "desc",
            },
        });

        // Transform data for the frontend
        const queueItems = works.map((item) => {
            // Determine consolidated status
            let status = 'PENDING';
            let overallRisk = 'UNCLEAR';

            if (item.qualityAssessments.length > 0) {
                const completed = item.qualityAssessments.some(a => a.status === 'COMPLETED');
                status = completed ? 'COMPLETED' : 'IN_PROGRESS';

                // Use the most recent completed assessment for risk
                const recent = item.qualityAssessments.find(a => a.status === 'COMPLETED') || item.qualityAssessments[0];
                if (recent && recent.overallScore) {
                    overallRisk = recent.overallScore; // e.g. "High Risk", "Low Risk"
                }
            }

            const assessors = item.qualityAssessments.map(d => d.assessor.name || "Unknown");

            return {
                id: item.id, // ProjectWork ID
                study: {
                    title: item.work.title,
                    authors: Array.isArray(item.work.authors)
                        ? (item.work.authors as any[]).map((a: any) => a.name).join(", ")
                        : "Unknown Authors",
                    year: item.work.year || 0
                },
                status,
                riskLevel: overallRisk,
                assessors: [...new Set(assessors)] // Deduplicate
            };
        });

        return NextResponse.json(queueItems);

    } catch (error) {
        console.error("[QUALITY_QUEUE_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
