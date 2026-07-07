import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { platformProfileSchema, type PlatformProfile } from "@thalon/contracts";
import { resolveProprietaryDir } from "../proprietary-dir";

const profilesDir = resolveProprietaryDir("profiles");

export interface LoadedPlatformProfile {
  platform: string;
  /** `<platform>.v<N>` — the shipped profile FILE's version (SPINE §3.2: profiles are versioned data files; bump on any change). */
  profileVersion: string;
  profile: PlatformProfile;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Loads the shipped generic niche/platform profile for `platform`, if one
 * exists (SPINE §2.2: niche/brand profile templates are versioned DATA
 * files, never code). Picks the highest `.v<N>.json` version present. The
 * lookup is platform-name-generic — nothing LinkedIn/X-specific is
 * hard-coded here; only the shipped JSON files themselves name a platform.
 * Returns null when no shipped default exists for this platform — callers
 * fall back to a tenant-supplied `brand_profiles.platformProfiles` entry, or
 * fail loud if neither exists.
 */
export function loadPlatformProfile(platform: string): LoadedPlatformProfile | null {
  let entries: string[];
  try {
    entries = readdirSync(profilesDir);
  } catch {
    return null;
  }
  const pattern = new RegExp(`^${escapeRegExp(platform)}\\.v(\\d+)\\.json$`);
  let best: { version: number; file: string } | null = null;
  for (const entry of entries) {
    const match = pattern.exec(entry);
    if (!match) continue;
    const version = Number(match[1]);
    if (!best || version > best.version) best = { version, file: entry };
  }
  if (!best) return null;
  const raw = JSON.parse(readFileSync(path.join(profilesDir, best.file), "utf8"));
  const profile = platformProfileSchema.parse(raw);
  return { platform, profileVersion: `${platform}.v${best.version}`, profile };
}
