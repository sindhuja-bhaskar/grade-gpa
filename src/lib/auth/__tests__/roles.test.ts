import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { can, requirePermission } from "../roles";

describe("role permissions (DA3 Q2(b))", () => {
  it("lets a student read and write their records", () => {
    expect(can("STUDENT", "records:read")).toBe(true);
    expect(can("STUDENT", "records:write")).toBe(true);
  });

  it("keeps an advisor read-only", () => {
    expect(can("ADVISOR", "records:read")).toBe(true);
    expect(can("ADVISOR", "records:write")).toBe(false);
  });

  it("refuses a write with 403, not 401 — the caller is signed in (§31)", () => {
    const advisor = { id: "u1", email: "a@example.com", role: "ADVISOR" as const };
    try {
      requirePermission(advisor, "records:write");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(403);
    }
  });
});
