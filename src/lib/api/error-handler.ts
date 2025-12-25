/**
 * API Error Handler
 * 3-layer defense pattern: Never expose internal errors to users
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import type { ApiErrorResponse, ErrorCode } from "@/types/api";

// ============== ERROR CLASSES ==============

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, string[]>) {
    super("VALIDATION_ERROR", message, 400, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = "Authentication required") {
    super("UNAUTHORIZED", message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = "You don't have permission to access this resource") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = "Resource") {
    super("NOT_FOUND", `${resource} not found`, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = "Resource conflict") {
    super("CONFLICT", message, 409);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = "Too many requests. Please try again later.") {
    super("RATE_LIMITED", message, 429);
    this.name = "RateLimitError";
  }
}

// ============== ERROR MAPPING ==============

/**
 * Map Prisma errors to user-safe messages
 */
function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): ApiError {
  switch (error.code) {
    case "P2002":
      // Unique constraint violation
      const field = (error.meta?.target as string[])?.join(", ") || "field";
      return new ConflictError(`A record with this ${field} already exists`);
    
    case "P2025":
      // Record not found
      return new NotFoundError("Record");
    
    case "P2003":
      // Foreign key constraint violation
      return new ValidationError("Invalid reference to related record");
    
    case "P2014":
      // Required relation violation
      return new ValidationError("Required related record is missing");
    
    default:
      console.error("Prisma error:", error);
      return new ApiError("SERVER_ERROR", "A database error occurred", 500);
  }
}

/**
 * Map Zod validation errors to user-friendly format
 */
function mapZodError(error: ZodError): ValidationError {
  const details: Record<string, string[]> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join(".");
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(err.message);
  });
  
  return new ValidationError("Validation failed", details);
}

// ============== MAIN ERROR HANDLER ==============

/**
 * Convert any error to a safe API response
 * Never exposes internal error details to users
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  console.error("API Error:", error);
  
  // Generate request ID for tracking
  const requestId = crypto.randomUUID();
  
  // Handle known error types
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
      { status: error.statusCode }
    );
  }
  
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const apiError = mapZodError(error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: apiError.code,
          message: apiError.message,
          details: apiError.details,
          requestId,
        },
      },
      { status: 400 }
    );
  }
  
  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const apiError = mapPrismaError(error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: apiError.code,
          message: apiError.message,
          requestId,
        },
      },
      { status: apiError.statusCode }
    );
  }
  
  // Handle Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid data provided",
          requestId,
        },
      },
      { status: 400 }
    );
  }
  
  // Handle standard Error
  if (error instanceof Error) {
    // Check for specific error messages
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
            requestId,
          },
        },
        { status: 401 }
      );
    }
    
    if (error.message === "Forbidden") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You don't have permission to access this resource",
            requestId,
          },
        },
        { status: 403 }
      );
    }
  }
  
  // Default: Internal server error (never expose details)
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
        requestId,
      },
    },
    { status: 500 }
  );
}

// ============== ERROR WRAPPER ==============

/**
 * Wrap an API handler with error handling
 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  return handler().catch(handleApiError);
}

