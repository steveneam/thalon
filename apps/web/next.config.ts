import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship as TypeScript source — Next transpiles them.
  transpilePackages: ["@thalon/contracts", "@thalon/db", "@thalon/platform"],
  // WASM engine — must stay external to the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
