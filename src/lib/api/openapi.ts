import { z } from "zod";
import "@/lib/validation/schemas";

/**
 * OpenAPI 3.0 document (docs/reqs.md §31).
 *
 * Generated from the same Zod schemas the handlers validate against, so the
 * published contract, the runtime validation and the TypeScript types cannot
 * drift apart. Adding a schema to src/lib/validation/schemas.ts with `.meta({id})`
 * is enough for it to appear here.
 */

const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });

function body(id: string) {
  return {
    required: true,
    content: { "application/json": { schema: ref(id) } },
  };
}

function jsonResponse(description: string) {
  return { description, content: { "application/json": {} } };
}

const errorResponses = {
  "401": { description: "No valid session (§31).", content: { "application/json": { schema: errorSchema } } },
  "403": { description: "The record belongs to another student (§8.2).", content: { "application/json": { schema: errorSchema } } },
  "404": { description: "Not found.", content: { "application/json": { schema: errorSchema } } },
  "422": { description: "Validation failed (§37).", content: { "application/json": { schema: errorSchema } } },
} as const;

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
} as const;

function crud(resource: string, createId: string, updateId: string) {
  return {
    [`/api/${resource}`]: {
      get: {
        tags: [resource],
        summary: `List ${resource}`,
        responses: { "200": jsonResponse("The student's own records."), ...errorResponses },
      },
      post: {
        tags: [resource],
        summary: `Create a ${resource.replace(/s$/, "")}`,
        requestBody: body(createId),
        responses: { "201": jsonResponse("Created."), ...errorResponses },
      },
    },
    [`/api/${resource}/{id}`]: {
      get: {
        tags: [resource],
        summary: `Read one ${resource.replace(/s$/, "")}`,
        parameters: [idParam],
        responses: { "200": jsonResponse("The record."), ...errorResponses },
      },
      put: {
        tags: [resource],
        summary: `Update a ${resource.replace(/s$/, "")}`,
        parameters: [idParam],
        requestBody: body(updateId),
        responses: { "200": jsonResponse("Updated."), ...errorResponses },
      },
      delete: {
        tags: [resource],
        summary: `Delete a ${resource.replace(/s$/, "")}`,
        parameters: [idParam],
        responses: { "204": { description: "Deleted." }, ...errorResponses },
      },
    },
  };
}

export function buildOpenApiDocument() {
  const registry = z.toJSONSchema(z.globalRegistry, {
    target: "openapi-3.0",
    io: "input",
    uri: (id) => `#/components/schemas/${id}`,
  }) as { schemas: Record<string, unknown> };

  return {
    openapi: "3.0.3",
    info: {
      title: "Grade/GPA Planner API",
      version: "1.0.0",
      description:
        "REST API for the Grade/GPA Planner (SRS v2.1). Every endpoint except " +
        "/api/auth/register and /api/auth/login requires a session. Sessions are " +
        "managed by Auth.js: an httpOnly cookie carries the session, and the " +
        "matching server-side record can be revoked at any time. Auth.js's own " +
        "endpoints (/api/auth/session, /csrf, /signin, /signout, /callback/*) " +
        "are also available for browser clients.",
    },
    tags: [
      { name: "auth", description: "Registration, login, refresh, logout (§8)" },
      { name: "users", description: "The signed-in student's profile (§8.2)" },
      { name: "semesters", description: "Academic years and semesters (§9, §27)" },
      { name: "subjects", description: "Subjects and their schemes (§10)" },
      { name: "assessments", description: "Progressive mark entry (§11–§14)" },
      { name: "goals", description: "GPA and CGPA targets (§21)" },
      { name: "analysis", description: "GPA, CGPA, performance, recommendations" },
    ],
    components: {
      schemas: registry.schemas,
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "authjs.session-token",
          description:
            "Auth.js session cookie, set by /api/auth/login or /api/auth/register. " +
            "Prefixed __Secure- when issued over HTTPS.",
        },
      },
    },
    security: [{ sessionCookie: [] }],
    paths: {
      "/api/auth/register": {
        post: {
          tags: ["auth"],
          summary: "Create an account and start a session",
          security: [],
          requestBody: body("RegisterRequest"),
          responses: {
            "201": jsonResponse("Account created."),
            "409": jsonResponse("That email is already registered."),
            "422": errorResponses["422"],
            "429": jsonResponse("Rate limited (§35.11)."),
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["auth"],
          summary: "Start a session",
          security: [],
          requestBody: body("LoginRequest"),
          responses: {
            "200": jsonResponse("Signed in; session cookie set."),
            "401": errorResponses["401"],
            "429": jsonResponse("Rate limited (§35.11)."),
          },
        },
      },
      "/api/auth/refresh": {
        post: {
          tags: ["auth"],
          summary: "Extend the current session",
          description:
            "Sessions slide automatically as they age; this endpoint is the " +
            "explicit equivalent and returns the new expiry.",
          responses: {
            "200": jsonResponse("Session extended."),
            "401": errorResponses["401"],
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["auth"],
          summary: "End the session and delete its server-side record",
          responses: { "200": jsonResponse("Signed out.") },
        },
      },
      "/api/users/me": {
        get: {
          tags: ["users"],
          summary: "The signed-in student's profile",
          responses: { "200": jsonResponse("Profile."), ...errorResponses },
        },
        put: {
          tags: ["users"],
          summary: "Update the profile",
          requestBody: body("UpdateProfileRequest"),
          responses: { "200": jsonResponse("Updated."), ...errorResponses },
        },
        delete: {
          tags: ["users"],
          summary: "Delete the account and all of its records",
          responses: { "204": { description: "Deleted." }, ...errorResponses },
        },
      },
      ...crud("semesters", "SemesterCreateRequest", "SemesterUpdateRequest"),
      ...crud("subjects", "SubjectCreateRequest", "SubjectUpdateRequest"),
      ...crud("assessments", "AssessmentCreateRequest", "AssessmentUpdateRequest"),
      "/api/goals": {
        get: {
          tags: ["goals"],
          summary: "List targets",
          responses: { "200": jsonResponse("Goals."), ...errorResponses },
        },
        post: {
          tags: ["goals"],
          summary: "Set a semester GPA or overall CGPA target",
          requestBody: body("GoalCreateRequest"),
          responses: { "201": jsonResponse("Goal saved."), ...errorResponses },
        },
      },
      "/api/goals/{id}": {
        put: {
          tags: ["goals"],
          summary: "Update a target",
          parameters: [idParam],
          requestBody: body("GoalUpdateRequest"),
          responses: { "200": jsonResponse("Updated."), ...errorResponses },
        },
        delete: {
          tags: ["goals"],
          summary: "Delete a target",
          parameters: [idParam],
          responses: { "204": { description: "Deleted." }, ...errorResponses },
        },
      },
      "/api/gpa": {
        get: {
          tags: ["analysis"],
          summary: "Official semester GPA (§19)",
          description:
            "A semester with no completed course returns value: null — 'not yet available', never 0.00 (BR-22).",
          parameters: [
            { name: "semesterId", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: { "200": jsonResponse("GPA per semester."), ...errorResponses },
        },
      },
      "/api/cgpa": {
        get: {
          tags: ["analysis"],
          summary: "Official CGPA and required future GPA (§20, §22)",
          parameters: [
            { name: "targetCgpa", in: "query", required: false, schema: { type: "number" } },
            { name: "futureCredits", in: "query", required: false, schema: { type: "number" } },
          ],
          responses: { "200": jsonResponse("CGPA and target plan."), ...errorResponses },
        },
      },
      "/api/performance": {
        get: {
          tags: ["analysis"],
          summary: "Ongoing performance, priorities and trends (§24, §25, §28)",
          description:
            "Ongoing subjects report a performance category and assessed marks, never a grade (BR-01, BR-13).",
          responses: { "200": jsonResponse("Performance analysis."), ...errorResponses },
        },
      },
      "/api/recommendations": {
        get: {
          tags: ["analysis"],
          summary: "Rule-based recommendations (§26)",
          responses: { "200": jsonResponse("Recommendations."), ...errorResponses },
        },
      },
    },
  };
}
