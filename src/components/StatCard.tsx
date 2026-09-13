export function StatCard({
  label,
  value,
  caption,
  tone = "default",
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "default" | "muted";
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </p>
      <p
        className={
          tone === "muted"
            ? "mt-2 text-xl font-medium text-[var(--color-muted)]"
            : "mt-2 text-3xl font-semibold tabular-nums"
        }
      >
        {value}
      </p>
      {caption ? (
        <p className="mt-2 text-sm text-[var(--color-muted)]">{caption}</p>
      ) : null}
    </div>
  );
}
