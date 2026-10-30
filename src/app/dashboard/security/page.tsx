import { requireUser } from "@/lib/auth/session";
import { getMfaStatus } from "@/lib/services/mfa";
import { MfaSetup } from "./MfaSetup";

/** Account security: the TOTP second factor (DA3, Q2(b)). */
export default async function SecurityPage() {
  const user = await requireUser();
  const status = await getMfaStatus(user.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Security</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Two-step sign-in asks for a 6-digit code from Google Authenticator or
        Microsoft Authenticator after your password, so a stolen password alone
        cannot open your academic record.
      </p>
      <MfaSetup initiallyEnabled={status.enabled} />
    </main>
  );
}
