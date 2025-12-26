import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Check if NEXTAUTH_SECRET is configured
  if (!process.env.NEXTAUTH_SECRET) {
    // If not configured, show a setup page for root route only
    if (request.nextUrl.pathname === "/") {
      return NextResponse.json({
        error: "Application not configured",
        message: "Please configure environment variables in Vercel dashboard",
        required: ["NEXTAUTH_SECRET", "DATABASE_URL"]
      }, { status: 503 });
    }
  }

  const isAuthPage = request.nextUrl.pathname.startsWith("/login") || 
                     request.nextUrl.pathname.startsWith("/verify-request") ||
                     request.nextUrl.pathname.startsWith("/register") ||
                     request.nextUrl.pathname.startsWith("/onboarding");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const isPublicRoute = request.nextUrl.pathname === "/" || 
                        request.nextUrl.pathname.startsWith("/_next") ||
                        request.nextUrl.pathname.startsWith("/icons") ||
                        request.nextUrl.pathname.startsWith("/manifest");

  // Allow all routes to pass - NextAuth will handle auth
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox).*)",
  ],
};

