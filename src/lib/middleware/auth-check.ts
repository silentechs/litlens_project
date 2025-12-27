import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { validateApiKey } from "@/lib/services/api-keys";
import { UnauthorizedError } from "@/lib/api/error-handler";

export interface AuthenticatedIdentity {
    userId?: string;
    organizationId?: string;
    type: "session" | "api_key";
    apiKeyId?: string;
}

/**
 * Authenticate a request using either a session cookie or an API key
 */
export async function authenticateRequest(
    request: NextRequest
): Promise<AuthenticatedIdentity> {
    // 1. Check for API key in Authorization header
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const apiKey = authHeader.substring(7);
        const result = await validateApiKey(apiKey);

        if (result.valid && result.apiKey) {
            return {
                organizationId: result.organizationId,
                type: "api_key",
                apiKeyId: result.apiKey.id,
            };
        }

        throw new UnauthorizedError(result.error || "Invalid API key");
    }

    // 2. Check for session cookie
    const session = await auth();
    if (session?.user?.id) {
        return {
            userId: session.user.id,
            type: "session",
        };
    }

    throw new UnauthorizedError("Authentication required");
}
