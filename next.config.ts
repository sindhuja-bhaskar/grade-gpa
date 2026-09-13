import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The calculation engine and data access must never reach the browser
  // (docs/reqs.md §7, §41). `server-only` imports make such a mistake a build
  // error; typed routes catch broken links at build time.
  typedRoutes: true,
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "bcryptjs"],
};

export default nextConfig;
