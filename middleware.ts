import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") || 
                     req.nextUrl.pathname.startsWith("/verify-request") ||
                     req.nextUrl.pathname.startsWith("/onboarding");
  const isApiAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
  const isPublicRoute = req.nextUrl.pathname === "/" || 
                        req.nextUrl.pathname.startsWith("/api/search/external");

  // Debug logging in development
  if (process.env.NODE_ENV === "development") {
    console.log(`[Middleware] ${req.method} ${req.nextUrl.pathname} - isLoggedIn: ${isLoggedIn}`);
  }

  // Allow auth routes
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Redirect non-logged-in users to login (except for public routes)
  if (!isLoggedIn && !isAuthPage && !isPublicRoute) {
    const callbackUrl = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, req.nextUrl));
  }

  return NextResponse.next();
});

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

