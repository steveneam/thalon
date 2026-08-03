import path from "node:path";
import { describe, expect, it } from "vitest";
import { readEnv, resolveDataDir } from "../env";

/**
 * The one-root ratchet (s97). A relative THALON_DATA_DIR must mean the SAME
 * directory from every cwd in the workspace — resolved against cwd it split
 * into two stores (`next dev` in apps/web vs everything at the repo root)
 * and bit three times: s79 dangling llm-cache pointers, the s96 backfill's
 * 66 orphaned posters, the sweep scheduler writing sweeps the app never saw.
 * Invariant, never loosened.
 */
const repoRoot = path.resolve(__dirname, "../../../..");

describe("one data root per workspace", () => {
  it("resolves a relative dir to the same directory from the repo root and from apps/web", () => {
    const fromRoot = resolveDataDir(".data", repoRoot);
    const fromWebApp = resolveDataDir(".data", path.join(repoRoot, "apps", "web"));
    expect(fromRoot).toBe(path.join(repoRoot, ".data"));
    expect(fromWebApp).toBe(fromRoot);
  });

  it("passes an absolute dir through untouched (Docker's /data, hermetic test tmpdirs)", () => {
    const abs = path.resolve(repoRoot, "somewhere", "else");
    expect(resolveDataDir(abs, path.join(repoRoot, "apps", "web"))).toBe(abs);
  });

  it("readEnv ships THALON_DATA_DIR pre-resolved and absolute", () => {
    const env = readEnv({});
    expect(path.isAbsolute(env.THALON_DATA_DIR)).toBe(true);
    expect(env.THALON_DATA_DIR).toBe(resolveDataDir(".data", process.cwd()));
  });
});
