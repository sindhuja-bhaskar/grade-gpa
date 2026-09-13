import { ZodError } from "zod";

/**
 * API error shape (docs/reqs.md §31, §37).
 *
 * §31 requires 401 (missing/invalid token) and 403 (someone else's record) to
 * stay distinct, and §37 requires invalid data to produce a clear message
 * rather than a generic failure.
 */

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly issues: FieldIssue[];

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    issues: FieldIssue[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  static unauthorized(message = "Authentication is required."): ApiError {
    return new ApiError(401, "UNAUTHORIZED", message);
  }

  /** Used when a record exists but belongs to another student (§8.2). */
  static forbidden(
    message = "This record belongs to another student.",
  ): ApiError {
    return new ApiError(403, "FORBIDDEN", message);
  }

  static notFound(what = "Record"): ApiError {
    return new ApiError(404, "NOT_FOUND", `${what} was not found.`);
  }

  static validation(message: string, issues: FieldIssue[] = []): ApiError {
    return new ApiError(422, "VALIDATION_ERROR", message, issues);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, "CONFLICT", message);
  }

  static rateLimited(retryAfterSeconds: number): ApiError {
    return new ApiError(
      429,
      "RATE_LIMITED",
      `Too many attempts. Try again in ${retryAfterSeconds} seconds.`,
    );
  }

  static fromZod(error: ZodError): ApiError {
    return ApiError.validation(
      "The submitted data is not valid.",
      error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
}
