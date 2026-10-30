"use client";

import { useState } from "react";

type Enrolment = { qrCodeDataUrl: string; secret: string };

async function call(method: "POST" | "PUT" | "DELETE", body?: unknown) {
  const response = await fetch("/api/auth/mfa", {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Something went wrong. Try again.");
  }
  return payload.data;
}

export function MfaSetup({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setPending(false);
    }
  }

  function codeFrom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return String(new FormData(event.currentTarget).get("code") ?? "");
  }

  return (
    <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-white p-6">
      <h2 className="font-medium">Authenticator app</h2>
      <p className="mt-1 text-sm">
        Status:{" "}
        <strong className={enabled ? "text-[var(--color-strong)]" : undefined}>
          {enabled ? "Enabled" : "Not enabled"}
        </strong>
      </p>

      {!enabled && !enrolment ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(async () => setEnrolment(await call("POST")))}
          className="mt-4 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Set up authenticator
        </button>
      ) : null}

      {!enabled && enrolment ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm">
            1. Scan this code with Google Authenticator or Microsoft
            Authenticator.
          </p>
          {/* A data: URL generated server-side; next/image adds nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrolment.qrCodeDataUrl}
            alt="QR code for your authenticator app"
            width={240}
            height={240}
          />
          <p className="text-xs text-[var(--color-muted)]">
            Can’t scan? Enter this key manually:{" "}
            <code className="break-all">{enrolment.secret}</code>
          </p>
          <form
            onSubmit={(event) => {
              const code = codeFrom(event);
              void run(async () => {
                await call("PUT", { code });
                setEnabled(true);
                setEnrolment(null);
                setMessage("Two-step sign-in is now on.");
              });
            }}
            className="flex gap-2"
          >
            <CodeInput label="2. Enter the 6-digit code it shows" />
            <button
              type="submit"
              disabled={pending}
              className="self-end rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Turn on
            </button>
          </form>
        </div>
      ) : null}

      {enabled ? (
        <form
          onSubmit={(event) => {
            const code = codeFrom(event);
            void run(async () => {
              await call("DELETE", { code });
              setEnabled(false);
              setMessage("Two-step sign-in is off.");
            });
          }}
          className="mt-4 flex gap-2"
        >
          <CodeInput label="Current code, to turn it off" />
          <button
            type="submit"
            disabled={pending}
            className="self-end rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm disabled:opacity-60"
          >
            Turn off
          </button>
        </form>
      ) : null}

      {message ? <p className="mt-4 text-sm text-[var(--color-strong)]">{message}</p> : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-[var(--color-risk)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function CodeInput({ label }: { label: string }) {
  return (
    <label className="block flex-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        name="code"
        required
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        autoComplete="one-time-code"
        className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 tracking-widest outline-none focus:border-[var(--color-accent)]"
      />
    </label>
  );
}
