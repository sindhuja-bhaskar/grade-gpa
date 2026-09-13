/**
 * A short confirmation carried across a redirect.
 *
 * Deleting a record usually removes the very element that would have shown the
 * result, so the action redirects and the destination page says what happened.
 */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mt-4 rounded-lg border border-[var(--color-line)] bg-white px-4 py-3 text-sm"
    >
      {children}
    </p>
  );
}
