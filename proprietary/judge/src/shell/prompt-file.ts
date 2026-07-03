import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const promptsDir = fileURLToPath(new URL("../../../prompts", import.meta.url));

/** Reads a versioned prompt file from proprietary/prompts (SPINE §3.2: prompts are data, never inline strings). */
export function readPromptFile(fileName: string): string {
  return readFileSync(path.join(promptsDir, fileName), "utf8");
}
