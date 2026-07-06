import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship as TypeScript source — Next transpiles them.
  transpilePackages: ["@thalon/contracts", "@thalon/db", "@thalon/platform"],
  // WASM engine — must stay external to the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Dev and prod NEVER share a dist dir: a `next build` output sitting in
  // .next otherwise shadows `next dev`'s route manifest (every route added
  // since that build 404s in dev — hit during B6.2 verification), and the
  // forced restart dance can wedge Turbopack's persistent cache behind an
  // orphaned process. `next dev` sets NODE_ENV=development; build/start set
  // production, so the split is total.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
