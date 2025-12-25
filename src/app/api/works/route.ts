import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
    handleApiError,
    UnauthorizedError,
    success,
    created,
} from "@/lib/api";
import { z } from "zod";

// Schema for creating/saving a work to library
const createWorkSchema = z.object({
    // Required identifiers (at least one)
    doi: z.string().optional(),
    pmid: z.string().optional(),
    pmcid: z.string().optional(),
    openAlexId: z.string().optional(),

    // Required metadata
    title: z.string().min(1),

    // Optional metadata
    abstract: z.string().optional().nullable(),
    authors: z.array(z.object({
        name: z.string(),
        affiliation: z.string().optional().nullable(),
        orcid: z.string().optional().nullable(),
    })).optional().default([]),
    year: z.number().int().optional(),
    publicationDate: z.string().optional(),
    journal: z.string().optional(),
    volume: z.string().optional(),
    issue: z.string().optional(),
    pages: z.string().optional(),
    publisher: z.string().optional(),
    url: z.string().url().optional(),
    keywords: z.array(z.string()).optional().default([]),
    source: z.string().optional().default("discover"),

    // Library options
    saveToLibrary: z.boolean().optional().default(true),
    folderId: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
    notes: z.string().optional(),
});

// POST /api/works - Create or find a work and optionally save to library
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const body = await request.json();
        const data = createWorkSchema.parse(body);

        // Find existing work by identifier (order of priority: DOI > OpenAlex > PMID)
        let work = null;

        if (data.doi) {
            work = await db.work.findUnique({
                where: { doi: data.doi },
            });
        }

        if (!work && data.openAlexId) {
            work = await db.work.findUnique({
                where: { openAlexId: data.openAlexId },
            });
        }

        if (!work && data.pmid) {
            work = await db.work.findUnique({
                where: { pmid: data.pmid },
            });
        }

        // If work doesn't exist, create it
        if (!work) {
            work = await db.work.create({
                data: {
                    doi: data.doi,
                    pmid: data.pmid,
                    pmcid: data.pmcid,
                    openAlexId: data.openAlexId,
                    title: data.title,
                    abstract: data.abstract,
                    authors: data.authors,
                    year: data.year,
                    publicationDate: data.publicationDate ? new Date(data.publicationDate) : null,
                    journal: data.journal,
                    volume: data.volume,
                    issue: data.issue,
                    pages: data.pages,
                    publisher: data.publisher,
                    url: data.url,
                    keywords: data.keywords,
                    source: data.source,
                },
            });
        }

        // Save to library if requested
        let libraryItem = null;
        if (data.saveToLibrary) {
            // Check if already in library
            libraryItem = await db.libraryItem.findUnique({
                where: {
                    userId_workId: {
                        userId: session.user.id,
                        workId: work.id,
                    },
                },
            });

            if (!libraryItem) {
                // Create library item
                libraryItem = await db.libraryItem.create({
                    data: {
                        userId: session.user.id,
                        workId: work.id,
                        folderId: data.folderId,
                        tags: data.tags,
                        notes: data.notes,
                        readingStatus: "TO_READ",
                    },
                });
            } else {
                // Update existing library item if needed
                libraryItem = await db.libraryItem.update({
                    where: { id: libraryItem.id },
                    data: {
                        tags: data.tags.length > 0 ? data.tags : libraryItem.tags,
                        notes: data.notes || libraryItem.notes,
                        lastAccessedAt: new Date(),
                    },
                });
            }
        }

        return created({
            id: work.id, // Top-level id for client compatibility
            work: {
                id: work.id,
                doi: work.doi,
                title: work.title,
                authors: work.authors,
                year: work.year,
                journal: work.journal,
                abstract: work.abstract,
            },
            libraryItem: libraryItem ? {
                id: libraryItem.id,
                readingStatus: libraryItem.readingStatus,
                tags: libraryItem.tags,
            } : null,
            message: libraryItem ? "Saved to library" : "Work created",
        });
    } catch (error) {
        return handleApiError(error);
    }
}

// GET /api/works - Search works in database
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get("query") || "";
        const limit = parseInt(searchParams.get("limit") || "20", 10);

        // Search by DOI or title
        const works = await db.work.findMany({
            where: {
                OR: [
                    { doi: query },
                    { pmid: query },
                    { title: { contains: query, mode: "insensitive" } },
                ],
            },
            take: Math.min(limit, 100),
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                doi: true,
                pmid: true,
                openAlexId: true,
                title: true,
                abstract: true,
                authors: true,
                year: true,
                journal: true,
                citationCount: true,
            },
        });

        return success({
            items: works,
            total: works.length,
        });
    } catch (error) {
        return handleApiError(error);
    }
}
