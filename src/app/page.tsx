import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--color-muted)]">
          Academic planning
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Grade/GPA Planner
        </h1>
        <p className="mt-4 max-w-xl text-[var(--color-muted)]">
          Enter marks as assessments are released, see where you actually stand
          on the work assessed so far, and find out what the remaining
          assessments need to hit your target. Unavailable assessments are never
          counted as zero, and an ongoing subject never shows a grade.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/register"
          className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white"
        >
          Create an account
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-[var(--color-line)] bg-white px-5 py-2.5 text-sm font-medium"
        >
          Sign in
        </Link>
        <Link
          href="/api/docs"
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-[var(--color-muted)]"
        >
          API documentation
        </Link>
      </div>
    </main>
  );
}
