import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const promptsDir = fileURLToPath(new URL("../../../../../proprietary/prompts", import.meta.url));

/** Reads a versioned prompt file from proprietary/prompts (SPINE §3.2: prompts are data, never inline strings). Mirrors ../../fanout/shell/prompt-file.ts. */
export function readPromptFile(fileName: string): string {
  return readFileSync(path.join(promptsDir, fileName), "utf8");
}
