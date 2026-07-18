import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { resetIntelStore } from "@/lib/intel/store";
import { server } from "@/lib/testing/server";
import { resetIntelTestState, resetLibraryTestState, resetSavedViewsTestState } from "@/lib/testing/handlers";
import { resetStagedFlowStore } from "@/lib/staged-flow/store";

// Hermetic data dir: tests must NEVER read the developer's real `.data`
// (dogfooded posts/db leaked into the blog seam tests whenever the PGlite
// open won the single-writer race — local-only failures CI could never
// see). Set before any readEnv()/openDb() call in this worker.
process.env.THALON_DATA_DIR = mkdtempSync(path.join(tmpdir(), "web-test-data-"));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  // The staged-flow and intel fake drivers are module-level state shared
  // across a file's tests — re-seed them like resetHandlers resets MSW.
  resetStagedFlowStore();
  resetIntelStore();
  resetIntelTestState();
  resetLibraryTestState();
  resetSavedViewsTestState();
  cleanup();
});
afterAll(() => server.close());
