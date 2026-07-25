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

// jsdom ships no matchMedia; the Astryx shell (useMediaQuery — responsive
// mobile nav) needs a real function. Minimal stub: never matches, supports
// both listener APIs. Guarded so node-environment test files stay untouched.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// With matchMedia present, components that guarded on it (the landing's
// FeatureLoop autoplay) now reach jsdom's HTMLMediaElement.play — which is
// "Not implemented" and returns undefined instead of the spec's Promise.
// Give it the spec shape so `.play().catch(...)` works.
if (typeof window !== "undefined" && typeof HTMLMediaElement !== "undefined") {
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
}

// jsdom also ships no ResizeObserver (the Astryx AppShell measures its nav
// regions). No-op stub — layout math is a browser-pass concern, not jsdom's.
if (typeof window !== "undefined" && typeof window.ResizeObserver !== "function") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

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
