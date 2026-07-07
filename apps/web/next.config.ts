import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // B6.7 (ADR 0007): the VPS container runs the traced standalone server —
  // `.next/standalone/<workspace-relative>/server.js`, node_modules included
  // by @vercel/nft. The Dockerfile copies the runtime DATA dirs the code
  // resolves by cwd-upward walk (proprietary/prompts + profiles,
  // packages/db/drizzle) next to it and FAILS THE IMAGE BUILD if PGlite's
  // WASM assets didn't survive tracing (executable check, not a hope).
  output: "standalone",
  // Monorepo: trace from the workspace root so hoisted node_modules land in
  // the standalone output (anchored to this file, not cwd — the config
  // transpiles to CJS, so __dirname is real).
  outputFileTracingRoot: path.join(__dirname, "../.."),
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
