import { NextResponse } from "next/server";

/**
 * GET /api/docs — browsable API documentation (§31).
 *
 * Swagger UI is loaded from a CDN and pointed at /api/docs/openapi.json, which
 * is generated from the Zod request schemas.
 */
const SWAGGER_VERSION = "5.17.14";

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Grade/GPA Planner API</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.SwaggerUIBundle({
          url: "/api/docs/openapi.json",
          dom_id: "#swagger",
          docExpansion: "list",
          withCredentials: true,
        });
      };
    </script>
  </body>
</html>`;

export function GET() {
  return new NextResponse(page, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
