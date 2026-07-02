import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native addon — must stay external to the server bundle.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
