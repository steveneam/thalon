import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { resolveProprietaryDir } from "../proprietary-dir";

const profilesDir = resolveProprietaryDir("profiles");

/**
 * B2.4 exemplar knobs — config, never code (per-tenant/per-platform top-k
 * and on/off toggle). Mirrors ../fanout/profiles.ts's shipped-JSON pattern:
 * `<name>.v<N>.json`, highest version wins. Whether/how a caller (apps/web,
 * a dogfood script) turns `enabled`/`topK` into a
 * `runFanout({ exemplar: { k } })` call is that caller's decision — this
 * module only loads the data.
 */
export const exemplarProfileSchema = z.object({
  enabled: z.boolean().default(false),
  topK: z.number().int().positive().default(5),
});

export type ExemplarProfile = z.infer<typeof exemplarProfileSchema>;

export interface LoadedExemplarProfile {
  profileVersion: string;
  profile: ExemplarProfile;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Loads `proprietary/profiles/<name>.v<N>.json` (default name: "exemplar"),
 * picking the highest version present. Returns null when no shipped file
 * exists for `name` — callers default to `{ enabled: false }`.
 */
export function loadExemplarProfile(name: string = "exemplar"): LoadedExemplarProfile | null {
  let entries: string[];
  try {
    entries = readdirSync(profilesDir);
  } catch {
    return null;
  }
  const pattern = new RegExp(`^${escapeRegExp(name)}\\.v(\\d+)\\.json$`);
  let best: { version: number; file: string } | null = null;
  for (const entry of entries) {
    const match = pattern.exec(entry);
    if (!match) continue;
    const version = Number(match[1]);
    if (!best || version > best.version) best = { version, file: entry };
  }
  if (!best) return null;
  const raw = JSON.parse(readFileSync(path.join(profilesDir, best.file), "utf8"));
  const profile = exemplarProfileSchema.parse(raw);
  return { profileVersion: `${name}.v${best.version}`, profile };
}
