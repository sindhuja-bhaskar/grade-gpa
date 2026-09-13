import { prisma } from "@/lib/db";
import { parseBody, withUser } from "@/lib/api/handler";
import { noContent, ok } from "@/lib/api/respond";
import { signOut } from "@/auth";
import { updateProfileSchema } from "@/lib/validation/schemas";

/** GET /api/users/me — the signed-in student's own profile (§8.2). */
export const GET = withUser(async (_request, { user }) => {
  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  return ok(profile);
});

/** PUT /api/users/me — update the profile (§30.3). */
export const PUT = withUser(async (request, { user }) => {
  const input = await parseBody(request, updateProfileSchema);
  const profile = await prisma.user.update({
    where: { id: user.id },
    data: { name: input.name },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  return ok(profile);
});

/**
 * DELETE /api/users/me — delete the account and every record it owns (§30.4).
 * Sessions cascade with the user row, so no other device stays signed in.
 */
export const DELETE = withUser(async (_request, { user }) => {
  await signOut({ redirect: false });
  await prisma.user.delete({ where: { id: user.id } });
  return noContent();
});
