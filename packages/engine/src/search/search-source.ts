import { readEnv } from "@thalon/platform";
import { z } from "zod";
import { createFakeSearchIntelSource } from "./fake-search-source";
import { gscSearchIntelSource } from "./gsc-source";

/**
 * B6.8 search-intel seam (ADR 0006 decision 1) — the demand-side sibling of
 * ../trend/trend-source.ts. A search intel source runs ONE read-only poll
 * against an OFFICIAL search-performance API and never persists anything —
 * only ./intake.ts, the core caller, writes (SPINE §1, the same read-only
 * driver contract as every other seam). The engine NEVER scrapes SERPs
 * (A5/A7 invariant): Google Search Console is the only live driver ever
 * wired (deploy-gated, B6.7 — see ./gsc-source.ts), paid SEO tools are a
 * RECORDED swap path (a named registry entry that fails loud, the
 * transcript-vendor pattern), and ./fake-search-source.ts is the
 * deterministic keyless double that also powers first-run dogfood.
 */

/** The poll window, validated at the seam boundary (GSC's Search Analytics request shape). */
export const searchPollRequestSchema = z.object({
  /** Inclusive ISO dates (YYYY-MM-DD) — the capture window the driver reports over. */
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
  /** Row cap for this poll — drivers may return fewer; per-day quota rationing is driver config. */
  rowLimit: z.number().int().positive().optional(),
});
export type SearchPollRequestInput = z.input<typeof searchPollRequestSchema>;
export type SearchPollRequest = z.infer<typeof searchPollRequestSchema>;

/**
 * One query's performance counters as a driver reports them. Metric names
 * are platform-generic name/value (SPINE §4.1) — GSC hands over
 * clicks/impressions/ctr/position; the horizon math maps names via config.
 */
export interface SearchIntelRow {
  query: string;
  /** Page/URL dimension; omit for the site-level aggregate. */
  page?: string;
  metrics: Record<string, number>;
}

export interface SearchIntelSource {
  readonly name: string;
  poll(request: SearchPollRequest): Promise<SearchIntelRow[]>;
}

const SOURCE_REGISTRY: Record<string, () => SearchIntelSource> = {
  fake: () => createFakeSearchIntelSource(),
  gsc: () => gscSearchIntelSource(),
  /** ADR 0006 decision 4d: paid SEO tools = a RECORDED swap path, deliberately not built. */
  "paid-vendor": () => {
    throw new Error(
      'search intel source "paid-vendor" is a recorded swap path, not built (ADR 0006) — paid SEO tools arrive as keyed vendor adapters behind this same seam if that path is ever taken',
    );
  },
};

export function registeredSearchIntelSources(): string[] {
  return Object.keys(SOURCE_REGISTRY);
}

/**
 * Env-selected seam resolution, mirroring TRANSCRIPT_PROVIDER: explicit
 * name > `SEARCH_INTEL_SOURCE` env > the keyless fake default. The env key
 * itself must live in the platform env choke point (packages/platform
 * env.ts — outside this lane's glob; flagged as the lead's one-line
 * addition, default "fake"). Until that line lands, `readEnv()`'s Zod
 * schema strips the unknown key, so the lookup below reads `undefined` and
 * resolution falls through to the fake — the selection activates with the
 * env.ts line, zero edits here.
 */
export function getSearchIntelSource(name?: string): SearchIntelSource {
  const env: Record<string, unknown> = readEnv();
  const fromEnv = env["SEARCH_INTEL_SOURCE"];
  const selected =
    name?.trim() || (typeof fromEnv === "string" && fromEnv ? fromEnv : "") || "fake";
  const factory = SOURCE_REGISTRY[selected];
  if (!factory) {
    throw new Error(
      `unknown search intel source "${selected}" — registered: ${registeredSearchIntelSources().join(", ")} (SEARCH_INTEL_SOURCE selects; drivers are config, never new intake code paths)`,
    );
  }
  return factory();
}
