import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveProprietaryDir } from "../../proprietary-dir";

const promptsDir = resolveProprietaryDir("prompts");

/** Reads a versioned prompt file from proprietary/prompts (SPINE 3.2: prompts are data, never inline strings). Path resolution lives in ../../proprietary-dir.ts (the B1.5/Turbopack lesson - apps/web bundles the engine since B6.5). */
export function readPromptFile(fileName: string): string {
  return readFileSync(path.join(promptsDir, fileName), "utf8");
}
