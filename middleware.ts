import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/projects",
  "/project",
  "/team",
  "/analytics",
  "/discover",
  "/alerts",
  "/library",
  "/graphs",
  "/writing",
  "/settings",
  "/notifications",
  "/admin",
];

// Routes that authenticated users shouldn't access (redirect to dashboard)
const authRoutes = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if NEXTAUTH_SECRET is configured
  if (!process.env.NEXTAUTH_SECRET) {
    if (pathname === "/") {
      return NextResponse.json({
        error: "Application not configured",
        message: "Please configure environment variables in Vercel dashboard",
        required: ["NEXTAUTH_SECRET", "DATABASE_URL"],
      }, { status: 503 });
    }
  }

  // Skip middleware for static assets and API routes
  const isApiRoute = pathname.startsWith("/api/");
  const isStaticAsset = 
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/manifest") ||
    pathname.includes(".") && !pathname.endsWith("/");

  if (isApiRoute || isStaticAsset) {
    return NextResponse.next();
  }

  // Get the session token (use AUTH_SECRET to match auth.ts config)
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  const isAuthenticated = !!token;

  // Check if current path matches protected routes
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Check if current path is an auth route (login, register)
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Redirect unauthenticated users trying to access protected routes to login
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages to dashboard
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox).*)",
  ],
};
