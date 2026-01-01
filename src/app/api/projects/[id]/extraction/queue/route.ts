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

        // Fetch studies ready for extraction (INCLUDED status)
        const works = await db.projectWork.findMany({
            where: {
                projectId,
                status: "INCLUDED",
            },
            include: {
                work: true,
                extractionData: {
                    where: {
                        projectId,
                    },
                    select: {
                        status: true,
                        extractorId: true,
                        extractor: {
                            select: { name: true }
                        }
                    }
                },
                qualityAssessments: {
                    where: {
                        projectId
                    },
                    select: {
                        overallScore: true,
                        assessorId: true
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
            if (item.extractionData.length > 0) {
                const allCompleted = item.extractionData.every(d => d.status === 'COMPLETED');
                const anyInProgress = item.extractionData.some(d => d.status === 'IN_PROGRESS');

                if (allCompleted && item.extractionData.length >= 2) { // Assuming dual extraction
                    status = 'COMPLETED';
                    // Simple logic for now: if we have discrepancies, it might be CONFLICT. 
                    // Real logic would check for ExtractionDiscrepancy records.
                } else if (anyInProgress || item.extractionData.length > 0) {
                    status = 'IN_PROGRESS';
                }
            }

            // Determine quality status
            // Simple mapping from first assessment found (or aggregate)
            let qualityStatus = 'PENDING';
            if (item.qualityAssessments.length > 0) {
                const score = item.qualityAssessments[0].overallScore; // Grab the first one for now
                if (score === 'Low Risk') qualityStatus = 'PASS';
                else if (score === 'High Risk') qualityStatus = 'FAIL';
                else if (score === 'Some Concerns') qualityStatus = 'FLAGGED';
            }

            const extractors = item.extractionData.map(d => d.extractor.name || "Unknown");

            return {
                id: item.id,
                study: {
                    title: item.work.title,
                    authors: Array.isArray(item.work.authors)
                        ? (item.work.authors as any[]).map((a: any) => a.name).join(", ")
                        : "Unknown Authors", // Simplify for list view
                    year: item.work.year || 0
                },
                status,
                qualityStatus,
                reviewers: extractors
            };
        });

        return NextResponse.json({ success: true, data: queueItems });

    } catch (error) {
        console.error("[EXTRACTION_QUEUE_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
