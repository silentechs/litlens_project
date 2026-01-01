import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: "/login",
        signOut: "/login",
        error: "/login",
        verifyRequest: "/verify-request",
        newUser: "/onboarding",
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    providers: [], // Providers are configured in auth.ts to avoid Edge runtime issues with some adapters/providers
    secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;
