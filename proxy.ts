import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "./lib/auth";

// Reachable without a session. The PWA fetches these before login, so they
// cannot sit behind the auth check.
const PUBLIC_PATHS = new Set(["/login", "/manifest.json", "/sw.js"]);

// Previously any path containing a dot skipped authentication, which made the
// auth boundary depend on route names never containing one. Match real static
// asset extensions instead.
const STATIC_ASSET = /\.(?:ico|png|jpe?g|svg|gif|webp|avif|woff2?|ttf|otf|css|js|map|txt|webmanifest)$/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login and public assets
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next") ||
    STATIC_ASSET.test(pathname)
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("session")?.value;

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    // Remember redirect destination
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifySession(sessionCookie);
  if (!session || !session.authenticated) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("session");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all requests except static files or public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
