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
  // DEV ONLY. Next dev blocks cross-origin requests to `/_next/*` dev assets,
  // and it counts `127.0.0.1` as a DIFFERENT origin from the `localhost` it
  // booted on. Hitting the dev box on the wrong one is not a visible error: the
  // HTML and the API still answer 200, but every client chunk is blocked, React
  // never hydrates, and each surface paints its SSR loading state forever —
  // "Reading the runs…" under a "No tenant" topbar. That reads exactly like a
  // broken workspace and is not one; it cost a real debugging hour in s76.
  // Allowing the loopback alias here means the screenshot gate, a curl-minded
  // agent, and anyone typing an IP all get the same working workspace.
  // Remote viewers (the founder's laptop reaching this box by host or IP) add
  // theirs via THALON_DEV_ORIGINS — env, not a tracked file, so no box address
  // is ever committed (stealth posture unchanged).
  allowedDevOrigins: [
    "127.0.0.1",
    ...(process.env.THALON_DEV_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? []),
  ],
  // DEV ONLY (founder direction s50): opening the dev box's root lands in
  // the workspace — the operator's daily door is /app, not the marketing
  // landing. Non-permanent and development-gated: production keeps the
  // landing at / (stealth posture unchanged). Escape hatch for design work:
  // `/?landing` still serves the landing page in dev.
  async redirects() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/",
        destination: "/app",
        permanent: false,
        missing: [{ type: "query", key: "landing" }],
      },
    ];
  },
};

export default nextConfig;
