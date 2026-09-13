import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/api/openapi";

/** GET /api/docs/openapi.json — the published OpenAPI 3.x document (§31). */
export function GET() {
  return NextResponse.json(buildOpenApiDocument());
}
