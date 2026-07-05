import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { resetStagedFlowStore } from "@/lib/staged-flow/store";
import { server } from "@/lib/testing/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  // The staged-flow fake driver is module-level state shared across a file's
  // tests — re-seed it like resetHandlers resets MSW.
  resetStagedFlowStore();
  cleanup();
});
afterAll(() => server.close());
