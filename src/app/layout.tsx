import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grade/GPA Planner",
  description:
    "Track assessments, calculate official GPA and CGPA, and plan the marks a target needs.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
