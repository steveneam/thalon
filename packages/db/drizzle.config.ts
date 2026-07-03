import { defineConfig } from "drizzle-kit";

// Generate-only config: migrations are created here (`npm run generate -w
// @thalon/db`) and applied by the migrator in src/client.ts against whichever
// driver the seam resolves (PGlite dev, Aurora prod — one dialect, A1).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
});
