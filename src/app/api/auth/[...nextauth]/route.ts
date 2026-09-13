import { handlers } from "@/auth";

/**
 * Auth.js endpoints: /api/auth/session, /csrf, /signin, /signout, /callback/*
 * (docs/reqs.md §8, §31).
 *
 * The REST endpoints the SRS names — /api/auth/login, /logout, /refresh,
 * /register — are separate route files; Next.js matches those exact segments
 * before this catch-all.
 */
export const { GET, POST } = handlers;
