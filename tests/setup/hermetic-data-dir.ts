import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A TEST SUITE MUST NEVER WRITE INTO THE DEVELOPER'S REAL DATA DIR (s79).
 *
 * `apps/web` has had this guard since the blog-seam tests leaked dogfooded
 * posts into their own fixtures; the engine and eval suites never got it, and
 * the bill arrived at s79.
 *
 * Because `THALON_DATA_DIR` was relative and the object-store root resolved
 * against the process's working directory, every root-cwd `npm test` wrote its
 * embeddings into the REPO's `.data/objects` — 704 of them — while sharing the
 * dev database that holds the `llm_cache` POINTERS. The dev server, running with
 * cwd `apps/web`, looked in `apps/web/.data/objects` and found 71. The first
 * cache row it inherited from a test run was a dead pointer, and video ingest
 * was permanently broken. The founder found it by pasting a YouTube URL.
 *
 * So this is not merely hygiene: an unhermetic suite was writing the state that
 * broke a shipped feature. Absolute, per-worker, and thrown away with the tmp
 * dir — set before any `readEnv()` / `openDb()` / `getObjectStore()` call.
 */
process.env.THALON_DATA_DIR = mkdtempSync(path.join(tmpdir(), "thalon-test-data-"));
