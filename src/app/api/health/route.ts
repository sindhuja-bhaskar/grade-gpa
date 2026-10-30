import { hostname } from "node:os";
import { NextResponse } from "next/server";

/**
 * GET /api/health — liveness probe for the Docker healthcheck and the Nginx
 * load balancer (DA3, Q1). Public, and deliberately free of any database call:
 * a slow cloud database must not make every instance look dead at once.
 *
 * `instance` is the container hostname, which is what shows that Nginx is
 * spreading requests across the replicas.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    instance: process.env.INSTANCE_NAME ?? hostname(),
  });
}
