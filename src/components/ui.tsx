"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/actions/form-state";

/** Small shared form pieces, so every CRUD page looks and behaves the same. */

export function Field({
  label,
  name,
  hint,
  error,
  children,
  ...props
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {children ?? (
        <input
          name={name}
          {...props}
          aria-invalid={error ? true : undefined}
          className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 outline-none focus:border-[var(--color-accent)] ${
            error ? "border-[var(--color-risk)]" : "border-[var(--color-line)]"
          }`}
        />
      )}
      {error ? (
        <span className="mt-1 block text-xs text-[var(--color-risk)]">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-[var(--color-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  error?: string;
}) {
  return (
    <Field label={label} name={name} error={error}>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 outline-none focus:border-[var(--color-accent)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const tone = {
    primary: "bg-[var(--color-accent)] text-white",
    secondary: "border border-[var(--color-line)] bg-white",
    danger: "border border-[var(--color-line)] bg-white text-[var(--color-risk)]",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${tone}`}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

/** Confirms before running a destructive action (§30.4). */
export function DeleteButton({
  children = "Delete",
  confirm,
}: {
  children?: React.ReactNode;
  confirm: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
      className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm text-[var(--color-risk)] disabled:opacity-60"
    >
      {pending ? "Deleting…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;

  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`text-sm ${isError ? "text-[var(--color-risk)]" : "text-[var(--color-strong)]"}`}
    >
      {state.message}
    </p>
  );
}
