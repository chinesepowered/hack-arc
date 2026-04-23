import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Next.js 16: the `middleware` file convention is deprecated in favor of
// `proxy`. The proxy runtime is always `nodejs` (no edge), which is fine for
// us because NextAuth's DB-backed authorize() needs Node APIs anyway.

const PUBLIC = new Set(["/", "/auth/sign-in", "/auth/sign-up"]);

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    PUBLIC.has(pathname)
  ) {
    return NextResponse.next();
  }
  if (!req.auth) {
    const url = new URL("/auth/sign-in", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
