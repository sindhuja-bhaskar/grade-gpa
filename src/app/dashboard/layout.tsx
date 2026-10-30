import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { signOutAction } from "./actions";

const NAV: Array<{ href: Route; label: string }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/semesters", label: "Semesters" },
  { href: "/dashboard/subjects", label: "Subjects" },
  { href: "/dashboard/goals", label: "Targets" },
  { href: "/dashboard/security", label: "Security" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-line)] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Grade/GPA Planner
          </Link>
          <nav className="flex flex-1 gap-4 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/api/docs"
              className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              API
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[var(--color-muted)]">
              {user.email}
              {user.role === "ADVISOR" ? " · advisor (read-only)" : null}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
