import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/cookie-names";

/**
 * Route protection (docs/reqs.md §33, §35).
 *
 * Next.js 16 renamed the middleware convention to `proxy`; this file is that
 * hook. It runs in the edge runtime, so it must not import anything that pulls
 * in a Node built-in — hence the bare cookie-name import above.
 *
 * A cheap first gate: unauthenticated traffic is turned away before it reaches
 * a handler. It is deliberately *not* the authorization boundary — the token is
 * verified and ownership is checked again inside every handler (§8.2), because
 * this hook cannot see which record is being requested.
 */

const PUBLIC_API_ROUTES = [
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/logout",
  // Auth.js's own endpoints (/api/auth/session, /csrf, /callback/...) guard
  // themselves and must stay reachable without a session.
  "/api/auth/session",
  "/api/auth/csrf",
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/auth/callback",
  "/api/auth/providers",
  "/api/auth/error",
  "/api/docs",
  // Load-balancer and container health probe (DA3); reveals no student data.
  "/api/health",
];

const PUBLIC_PAGES = ["/", "/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) =>
    Boolean(request.cookies.get(name)?.value),
  );

  if (pathname.startsWith("/api")) {
    if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
      return NextResponse.next();
    }
    const bearer = request.headers.get("authorization");
    if (hasSessionCookie || bearer?.toLowerCase().startsWith("bearer ")) {
      return NextResponse.next();
    }
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication is required." } },
      { status: 401 },
    );
  }

  if (PUBLIC_PAGES.includes(pathname)) {
    return hasSessionCookie && pathname !== "/"
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : NextResponse.next();
  }

  if (!hasSessionCookie) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
