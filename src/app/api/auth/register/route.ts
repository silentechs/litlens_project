import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import {
  handleApiError,
  ValidationError,
  ConflictError,
  created,
} from "@/lib/api";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/\d/, "Password must contain a number"),
});

// POST /api/auth/register - Register a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError("An account with this email already exists");
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        emailVerified: new Date(), // Consider email verified on registration
        preferences: {
          create: {}, // Create default preferences
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // Log activity
    await db.activity.create({
      data: {
        userId: user.id,
        type: "PROJECT_CREATED", // Using existing enum
        description: "User account created",
        metadata: {
          method: "registration",
        },
      },
    });

    return created({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      message: "Account created successfully. You can now sign in.",
    });
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors[0].message);
    }
    return handleApiError(error);
  }
}

