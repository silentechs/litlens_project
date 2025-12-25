import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  handleApiError,
  UnauthorizedError,
  success,
} from "@/lib/api";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  institution: z.string().max(200).optional(),
  bio: z.string().max(1000).optional(),
  orcid: z.string().max(50).optional(),
  role: z.string().max(50).optional(), // User-selected role for onboarding
});

// GET /api/user/profile - Get current user profile
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bio: true,
        orcid: true,
        institution: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        preferences: {
          select: {
            theme: true,
            emailNotifications: true,
            pushNotifications: true,
            inAppNotifications: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError();
    }

    return success({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/user/profile - Update current user profile
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const data = updateProfileSchema.parse(body);

    // Remove the role field from data since it's not a database field
    // (it's for frontend onboarding tracking only)
    const { role: _, ...updateData } = data;

    const user = await db.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bio: true,
        orcid: true,
        institution: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return success({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

