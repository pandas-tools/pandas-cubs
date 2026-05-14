import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const path = nextUrl.pathname;

  // Public routes
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/webhooks") ||
    path.startsWith("/api/health") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  // Authenticated routes
  if (!session?.user) {
    const loginUrl = new URL("/login", nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  const { role, onboardingCompleted } = session.user;

  // Admin gate
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/browse", nextUrl));
    }
    return NextResponse.next();
  }

  // Employee onboarding gate
  if (role === "employee" && !onboardingCompleted) {
    if (!path.startsWith("/onboarding")) {
      return NextResponse.redirect(new URL("/onboarding", nextUrl));
    }
  }

  // Admin redirected away from employee routes
  if (role === "admin" && (path.startsWith("/browse") || path.startsWith("/watch"))) {
    return NextResponse.redirect(new URL("/admin", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
