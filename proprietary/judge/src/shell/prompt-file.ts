import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Never use `new URL("<rel>", import.meta.url)` for this: Turbopack
 * statically analyzes that exact pattern and fails the apps/web production
 * build trying to bundle the directory as an asset — packages/db's
 * migrations lookup hit the same class at B1.5 (client.ts is the reference
 * shape this mirrors). Plain Node (tsx CLIs, vitest) resolves relative to
 * this source file; a bundled route (apps/web imports the judge since B2.6)
 * has a rewritten import.meta.url, so fall back to walking up from cwd to
 * the workspace's proprietary/prompts.
 */
function resolvePromptsDir(): string {
  try {
    const fromSource = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
      "prompts",
    );
    if (existsSync(fromSource)) return fromSource;
  } catch {
    // import.meta.url is not a usable file URL in this context — fall through.
  }
  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, "proprietary", "prompts");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        "could not locate the proprietary/prompts folder from this process (source-relative and cwd-upward lookups both failed)",
      );
    }
    dir = parent;
  }
}

const promptsDir = resolvePromptsDir();

/** Reads a versioned prompt file from proprietary/prompts (SPINE §3.2: prompts are data, never inline strings). */
export function readPromptFile(fileName: string): string {
  return readFileSync(path.join(promptsDir, fileName), "utf8");
}
