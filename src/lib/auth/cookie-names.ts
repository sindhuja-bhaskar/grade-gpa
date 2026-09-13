/**
 * Auth.js session cookie names.
 *
 * Kept in a module of their own, free of any Node built-in, because the proxy
 * (src/proxy.ts) runs in the edge runtime: importing the auth configuration
 * there would drag in `node:crypto` and Prisma and fail every request.
 *
 * Auth.js prefixes the cookie with `__Secure-` whenever it issues it over
 * HTTPS, so both spellings have to be checked.
 */

export const SESSION_COOKIE = "authjs.session-token";
export const SECURE_SESSION_COOKIE = "__Secure-authjs.session-token";

export const SESSION_COOKIE_NAMES = [
  SESSION_COOKIE,
  SECURE_SESSION_COOKIE,
] as const;
