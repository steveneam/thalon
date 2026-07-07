import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { resetIntelStore } from "@/lib/intel/store";
import { server } from "@/lib/testing/server";
import { resetIntelTestState, resetLibraryTestState } from "@/lib/testing/handlers";
import { resetStagedFlowStore } from "@/lib/staged-flow/store";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  // The staged-flow and intel fake drivers are module-level state shared
  // across a file's tests — re-seed them like resetHandlers resets MSW.
  resetStagedFlowStore();
  resetIntelStore();
  resetIntelTestState();
  resetLibraryTestState();
  cleanup();
});
afterAll(() => server.close());
