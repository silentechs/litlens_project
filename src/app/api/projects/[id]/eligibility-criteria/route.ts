import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  success,
} from "@/lib/api";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const eligibilityCriteriaSchema = z.object({
  population: z.string().optional().nullable(),
  intervention: z.string().optional().nullable(),
  comparison: z.string().optional().nullable(),
  outcomes: z.string().optional().nullable(),
  studyDesigns: z.array(z.string()).optional().default([]),
  includePreprints: z.boolean().optional().default(false),
  languageRestriction: z.array(z.string()).optional().default([]),
  yearMin: z.number().int().min(1900).max(2100).optional().nullable(),
  yearMax: z.number().int().min(1900).max(2100).optional().nullable(),
  customCriteria: z.any().optional().nullable(),
});

// GET /api/projects/[id]/eligibility-criteria - Get eligibility criteria
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

    // Get criteria
    const criteria = await db.eligibilityCriteria.findUnique({
      where: { projectId },
    });

    if (!criteria) {
      // Return empty criteria if not set
      return success({
        exists: false,
        criteria: null,
      });
    }

    return success({
      exists: true,
      criteria: {
        id: criteria.id,
        population: criteria.population,
        intervention: criteria.intervention,
        comparison: criteria.comparison,
        outcomes: criteria.outcomes,
        studyDesigns: criteria.studyDesigns,
        includePreprints: criteria.includePreprints,
        languageRestriction: criteria.languageRestriction,
        yearMin: criteria.yearMin,
        yearMax: criteria.yearMax,
        customCriteria: criteria.customCriteria,
        createdAt: criteria.createdAt.toISOString(),
        updatedAt: criteria.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects/[id]/eligibility-criteria - Create or update criteria
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;
    const body = await request.json();
    const data = eligibilityCriteriaSchema.parse(body);

    // Check project access - only leads can update criteria
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

    if (!["OWNER", "LEAD"].includes(membership.role)) {
      throw new ForbiddenError("Only project leads can update eligibility criteria");
    }

    // Upsert criteria
    const criteria = await db.eligibilityCriteria.upsert({
      where: { projectId },
      create: {
        projectId,
        createdBy: session.user.id,
        ...data,
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "PROJECT_UPDATED",
        description: `Updated eligibility criteria`,
        metadata: {
          hasPICOS: !!(data.population || data.intervention || data.comparison || data.outcomes),
          studyDesigns: data.studyDesigns,
        },
      },
    });

    return success({
      id: criteria.id,
      population: criteria.population,
      intervention: criteria.intervention,
      comparison: criteria.comparison,
      outcomes: criteria.outcomes,
      studyDesigns: criteria.studyDesigns,
      includePreprints: criteria.includePreprints,
      languageRestriction: criteria.languageRestriction,
      yearMin: criteria.yearMin,
      yearMax: criteria.yearMax,
      customCriteria: criteria.customCriteria,
      createdAt: criteria.createdAt.toISOString(),
      updatedAt: criteria.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/projects/[id]/eligibility-criteria - Delete criteria
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { id: projectId } = await params;

    // Check project access - only leads can delete criteria
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

    if (!["OWNER", "LEAD"].includes(membership.role)) {
      throw new ForbiddenError("Only project leads can delete eligibility criteria");
    }

    // Delete criteria
    await db.eligibilityCriteria.delete({
      where: { projectId },
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "PROJECT_UPDATED",
        description: `Deleted eligibility criteria`,
        metadata: {},
      },
    });

    return success({
      message: "Eligibility criteria deleted successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

