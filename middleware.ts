import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

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

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth;

  // Check if current path matches protected routes
  const isProtectedRoute = protectedRoutes.some(
    (route) => nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`)
  );

  // Check if current path is an auth route (login, register)
  const isAuthRoute = authRoutes.some(
    (route) => nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`)
  );

  // Redirect unauthenticated users trying to access protected routes to login
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages to dashboard
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox).*)",
  ],
};
