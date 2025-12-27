import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { db } from "./db";
import { z } from "zod";
import bcrypt from "bcryptjs";

// Credentials validation schema
const credentialsSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),

  providers: [
    // Magic Link via Resend
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.FROM_EMAIL || "LitLens <noreply@litlens.app>",
      sendVerificationRequest: async ({ identifier: email, url }) => {
        const { sendMagicLink } = await import("@/lib/services/email-service");
        await sendMagicLink({ email, url });
      },
    }),

    // Email/Password credentials
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) {
            console.log("[Auth] Invalid credentials format:", parsed.error.errors);
            return null;
          }

          const { email, password } = parsed.data;

          // Find user with password
          const user = await db.user.findUnique({
            where: { email: email.toLowerCase() },
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              password: true,
              role: true,
              emailVerified: true,
            },
          });

          // User not found or no password set
          if (!user) {
            console.log("[Auth] User not found:", email);
            return null;
          }

          if (!user.password) {
            console.log("[Auth] User has no password set (magic link user):", email);
            return null;
          }

          // Verify password
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            console.log("[Auth] Invalid password for:", email);
            return null;
          }

          console.log("[Auth] Login successful for:", email);

          // Return user data (without password)
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            emailVerified: user.emailVerified,
          };
        } catch (error) {
          console.error("[Auth] Authorization error:", error);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
    verifyRequest: "/verify-request",
    newUser: "/onboarding",
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || "USER";
      }

      // Fetch fresh user data on session update
      if (trigger === "update" && session) {
        const freshUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        });

        if (freshUser) {
          token.name = freshUser.name;
          token.email = freshUser.email;
          token.picture = freshUser.image;
          token.role = freshUser.role;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },

    async signIn({ user, account }) {
      // For credentials provider, always allow (password already verified)
      if (account?.provider === "credentials") {
        return true;
      }

      // For magic link, check email exists
      if (!user?.email) {
        return false;
      }

      return true;
    },
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      // Log sign in activity
      if (user.id) {
        await db.activity.create({
          data: {
            userId: user.id,
            type: "PROJECT_CREATED", // Using existing enum
            description: `User signed in via ${account?.provider || "credentials"}`,
            metadata: {
              provider: account?.provider || "credentials",
              isNewUser,
            },
          },
        }).catch(console.error);
      }
    },

    async createUser({ user }) {
      // Create default preferences for new users
      if (user.id) {
        await db.userPreferences.create({
          data: {
            userId: user.id,
          },
        }).catch(console.error);
      }
    },
  },

  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
});

// ============== PASSWORD UTILITIES ==============

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============== AUTH HELPERS ==============

/**
 * Get current session (for server components)
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

/**
 * Require authentication (throws if not authenticated)
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Check if user has a specific role
 */
export async function requireRole(roles: string[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role || "")) {
    throw new Error("Forbidden");
  }
  return user;
}

/**
 * Check if user is admin
 */
export async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

// ============== TYPE AUGMENTATION ==============

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
    };
  }

  interface User {
    role?: string;
    emailVerified?: Date | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}
