import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Role-based access (DA3, Q2(b)).
 *
 * A STUDENT owns and maintains their academic record. An ADVISOR (faculty
 * advisor) may sign in and read, but never change or delete marks, subjects,
 * semesters or goals — the integrity of an academic record matters more than
 * convenience. Ownership (§8.2) is still checked after this, in the services:
 * the role says *what* an account may do, ownership says *to which records*.
 */

export type Role = "STUDENT" | "ADVISOR";
export type Permission = "records:read" | "records:write";

const PERMISSIONS: Record<Role, readonly Permission[]> = {
  STUDENT: ["records:read", "records:write"],
  ADVISOR: ["records:read"],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

/** 403, not 401: the caller is signed in, just not allowed (§31). */
export function requirePermission(user: SessionUser, permission: Permission): void {
  if (!can(user.role, permission)) {
    throw ApiError.forbidden(
      `The ${user.role.toLowerCase()} role is not permitted to modify academic records.`,
    );
  }
}
