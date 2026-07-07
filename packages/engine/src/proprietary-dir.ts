import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves a proprietary/<subdir> data directory (prompts, profiles) for
 * every engine shell/loader — the ONE home for the B1.5/Turbopack lesson
 * inside this package.
 *
 * Never use `new URL("<rel>", import.meta.url)` for this: Turbopack
 * statically analyzes that exact pattern and fails the apps/web production
 * build trying to bundle the directory as an asset — packages/db's
 * migrations lookup hit the class at B1.5, the judge's prompts lookup hit it
 * again at B6.1 (proprietary/judge/src/shell/prompt-file.ts is the reference
 * shape this mirrors), and apps/web bundles the engine since B6.5. Plain
 * Node (tsx CLIs, vitest) resolves relative to this source file; a bundled
 * route has a rewritten import.meta.url, so fall back to walking up from cwd
 * to the workspace root.
 */
export function resolveProprietaryDir(subdir: "prompts" | "profiles"): string {
  try {
    // packages/engine/src → up three levels → the workspace root.
    const fromSource = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
      "proprietary",
      subdir,
    );
    if (existsSync(fromSource)) return fromSource;
  } catch {
    // import.meta.url is not a usable file URL in this context — fall through.
  }
  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, "proprietary", subdir);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `could not locate the proprietary/${subdir} folder from this process (source-relative and cwd-upward lookups both failed)`,
      );
    }
    dir = parent;
  }
}
