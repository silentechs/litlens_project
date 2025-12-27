import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
    handleApiError,
    UnauthorizedError,
    success,
} from "@/lib/api";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        let preferences = await db.userPreferences.findUnique({
            where: { userId: session.user.id },
        });

        // Create default preferences if they don't exist
        if (!preferences) {
            preferences = await db.userPreferences.create({
                data: {
                    userId: session.user.id,
                },
            });
        }

        return success(preferences);
    } catch (error) {
        return handleApiError(error);
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        const body = await request.json();

        // Filter out fields that shouldn't be patched directly
        const { id, userId, createdAt, updatedAt, ...updates } = body;

        const preferences = await db.userPreferences.upsert({
            where: { userId: session.user.id },
            update: updates,
            create: {
                userId: session.user.id,
                ...updates,
            },
        });

        return success(preferences);
    } catch (error) {
        return handleApiError(error);
    }
}
