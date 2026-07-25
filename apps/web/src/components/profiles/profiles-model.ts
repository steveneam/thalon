import type { ProfileWire } from "@/lib/profiles/types";

/**
 * Pure view-model for the rebuilt Profiles wizard. The save path itself stays
 * `lib/profiles/form.ts` (`formToConfig`, whose `carry` argument is the pinned
 * defence against the twice-live config-drop) — this file only maps the
 * sheet's Voice step onto the profile's open `voice` shape and describes what
 * the wizard is about to write.
 */

/** The sheet's own seven chips, in the sheet's order. */
export const TONE_CHIPS = [
  "Confident",
  "Concrete",
  "Playful",
  "No hype",
  "Technical",
  "Warm",
  "Contrarian",
] as const;

/** "Tone — pick up to three" is the sheet's rule, so it is the surface's rule. */
export const MAX_TONES = 3;

export interface VoiceRead {
  /** Chips that match what is stored. */
  tone: string[];
  /** `voice.sample` — the paragraph the engine drafts in the register of. */
  sample: string;
  /**
   * The stored tone rendered as text when it is NOT exactly the chip set —
   * a free-text tone ("direct, technical") the chips cannot represent. The
   * surface shows it, because picking chips would replace it.
   */
  storedTone: string | null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function readVoice(voice: Record<string, unknown>): VoiceRead {
  const raw = voice.tone;
  const stored =
    typeof raw === "string" ? raw : Array.isArray(raw) ? strings(raw).join(", ") : null;
  const tone =
    typeof raw === "string"
      ? TONE_CHIPS.filter((chip) => raw.toLowerCase().includes(chip.toLowerCase()))
      : strings(raw).filter((v): v is (typeof TONE_CHIPS)[number] =>
          (TONE_CHIPS as readonly string[]).includes(v),
        );
  return {
    tone,
    sample: typeof voice.sample === "string" ? voice.sample : "",
    storedTone: stored !== null && stored !== tone.join(", ") ? stored : null,
  };
}

/**
 * The Voice step's edits folded back into the profile's own voice object.
 * Every key the wizard doesn't own is preserved verbatim, and an UNTOUCHED
 * tone is left exactly as stored — a free-text register is never silently
 * rewritten into chips by a save the operator made for another reason.
 */
export function writeVoice(
  base: Record<string, unknown>,
  edit: { tone: string[]; toneTouched: boolean; sample: string },
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base };
  if (edit.toneTouched) {
    if (edit.tone.length > 0) next.tone = edit.tone;
    else delete next.tone;
  }
  if (edit.sample.trim()) next.sample = edit.sample.trim();
  else delete next.sample;
  return next;
}

export interface CadenceRow {
  platform: string;
  rule: string;
}

/** The carried cadence block, read-only — the judge enforces it; this wizard doesn't edit it yet. */
export function cadenceRows(profile: ProfileWire | null): CadenceRow[] {
  const cadence = profile?.config.cadence;
  if (!cadence) return [];
  return Object.entries(cadence).map(([platform, rule]) => {
    const parts: string[] = [];
    if (rule?.maxPerDay !== undefined) parts.push(`max ${rule.maxPerDay}/day`);
    if (rule?.maxPerWeek !== undefined) parts.push(`max ${rule.maxPerWeek}/week`);
    if (rule?.minGapMinutes !== undefined) parts.push(`min gap ${rule.minGapMinutes}m`);
    return { platform, rule: parts.length > 0 ? parts.join(" · ") : "no constraint set" };
  });
}

/**
 * The blocks this editor does NOT edit but MUST carry through every save.
 * Dropping them disarmed lead scoring, the cadence gate, routing, outreach
 * and the social publish door — found live on staging twice (2026-07-14,
 * 2026-07-19). The wizard's review step NAMES the ones present, so the carry
 * is visible provenance rather than an invisible promise.
 */
export const CARRIED_BLOCKS = [
  { key: "icp", label: "ICP", powers: "lead scoring" },
  { key: "cadence", label: "Cadence", powers: "the cadence gate" },
  { key: "routing", label: "Routing", powers: "bucket → platform routing" },
  { key: "outreach", label: "Outreach", powers: "the outreach sequence" },
  { key: "social", label: "Social", powers: "the publish door" },
] as const;

export function carriedBlocks(profile: ProfileWire | null): Array<{
  label: string;
  powers: string;
}> {
  if (!profile) return [];
  return CARRIED_BLOCKS.filter(
    ({ key }) => profile.config[key as keyof ProfileWire["config"]] !== undefined,
  ).map(({ label, powers }) => ({ label, powers }));
}

/** The version this edit will WRITE — saves append, never overwrite. */
export function nextVersion(profile: ProfileWire | null): number {
  return (profile?.version ?? 0) + 1;
}
