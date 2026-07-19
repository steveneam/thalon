import type { BrandProfileConfigInput } from "@thalon/contracts";
import type { ProfileWire } from "./types";

/**
 * Pure form ↔ config mapping for the profile editor. List fields edit as
 * one-item-per-line text; links as `label: url` lines; voice and
 * platform-profiles as JSON (they are open shapes by contract). Parsing
 * fails LOUD with a field-named message — an invalid profile never reaches
 * the wire half-saved.
 */
export interface ProfileFormState {
  company: string;
  oneLiner: string;
  philosophy: string;
  audience: string;
  offers: string;
  facts: string;
  topics: string;
  links: string;
  denylist: string;
  voiceJson: string;
  platformProfilesJson: string;
}

export function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(list: unknown): string {
  return Array.isArray(list) ? list.filter((v): v is string => typeof v === "string").join("\n") : "";
}

export function parseLinks(text: string): { links: Record<string, string>; error: string | null } {
  const links: Record<string, string> = {};
  for (const line of linesToList(text)) {
    const sep = line.indexOf(":");
    const label = line.slice(0, sep).trim();
    const url = line.slice(sep + 1).trim();
    if (sep < 1 || !label || !url) {
      return { links, error: `Links — each line needs "label: url" (got "${line}")` };
    }
    links[label] = url;
  }
  return { links, error: null };
}

function linksToText(links: unknown): string {
  if (!links || typeof links !== "object") return "";
  return Object.entries(links as Record<string, unknown>)
    .filter(([, url]) => typeof url === "string")
    .map(([label, url]) => `${label}: ${url as string}`)
    .join("\n");
}

function parseJsonObject(text: string, field: string): { value: Record<string, unknown>; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { value: {}, error: null };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { value: {}, error: `${field} must be a JSON object` };
    }
    return { value: parsed as Record<string, unknown>, error: null };
  } catch {
    return { value: {}, error: `${field} is not valid JSON` };
  }
}

function str(identity: Record<string, unknown>, key: string): string {
  const value = identity[key];
  return typeof value === "string" ? value : "";
}

export function profileToForm(profile: ProfileWire | null): ProfileFormState {
  const identity = profile?.config.identity ?? {};
  return {
    company: str(identity, "company"),
    oneLiner: str(identity, "oneLiner"),
    philosophy: str(identity, "philosophy"),
    audience: str(identity, "audience"),
    offers: listToLines(identity.offers),
    facts: listToLines(identity.facts),
    topics: listToLines(identity.topics),
    links: linksToText(identity.links),
    denylist: (profile?.config.denylist ?? []).join("\n"),
    voiceJson: profile && Object.keys(profile.config.voice).length ? JSON.stringify(profile.config.voice, null, 2) : "",
    platformProfilesJson:
      profile && Object.keys(profile.config.platformProfiles).length
        ? JSON.stringify(profile.config.platformProfiles, null, 2)
        : "",
  };
}

/** The non-form-backed blocks the editor doesn't edit but must never drop on save (window 1 + the window-2 outreach/social pair). */
export type CarriedConfigBlocks = Pick<
  ProfileWire["config"],
  "icp" | "cadence" | "routing" | "outreach" | "social"
>;

export function formToConfig(
  form: ProfileFormState,
  /**
   * The ACTIVE profile's non-form-backed blocks (icp · cadence · routing ·
   * outreach · social), carried through verbatim — a save built from the
   * form fields alone silently dropped them, disarming lead scoring / the
   * cadence gate / routing / outreach / the social publish door (found live
   * on staging, 2026-07-14; recurred for the window-2 pair, 2026-07-19).
   * Callers pass the fetched active wire config; absent blocks stay absent.
   */
  carry?: CarriedConfigBlocks,
): { config: BrandProfileConfigInput; error: null } | { config: null; error: string } {
  const { links, error: linksError } = parseLinks(form.links);
  if (linksError) return { config: null, error: linksError };
  const voice = parseJsonObject(form.voiceJson, "Voice");
  if (voice.error) return { config: null, error: voice.error };
  const platforms = parseJsonObject(form.platformProfilesJson, "Platform profiles");
  if (platforms.error) return { config: null, error: platforms.error };
  return {
    config: {
      voice: voice.value,
      denylist: linesToList(form.denylist),
      platformProfiles: platforms.value as BrandProfileConfigInput["platformProfiles"],
      identity: {
        ...(form.company.trim() ? { company: form.company.trim() } : {}),
        ...(form.oneLiner.trim() ? { oneLiner: form.oneLiner.trim() } : {}),
        ...(form.philosophy.trim() ? { philosophy: form.philosophy.trim() } : {}),
        ...(form.audience.trim() ? { audience: form.audience.trim() } : {}),
        offers: linesToList(form.offers),
        facts: linesToList(form.facts),
        topics: linesToList(form.topics),
        links,
      },
      ...(carry?.icp !== undefined ? { icp: carry.icp } : {}),
      ...(carry?.cadence !== undefined ? { cadence: carry.cadence } : {}),
      ...(carry?.routing !== undefined ? { routing: carry.routing } : {}),
      ...(carry?.outreach !== undefined ? { outreach: carry.outreach } : {}),
      ...(carry?.social !== undefined ? { social: carry.social } : {}),
    },
    error: null,
  };
}
