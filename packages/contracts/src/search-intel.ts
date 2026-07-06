import { z } from "zod";

/**
 * B6.8 (amendment A13 / ADR 0006): search intel — SEO/AEO/GEO as Intel's
 * SECOND HALF, not a fourth output family. Trend intel answers "what's
 * rising on social"; search intel answers "what are people asking search
 * and answer engines". Same architecture: config rows (`search_targets`,
 * mirroring `watchlists`) + append-only snapshots (`search_snapshots`,
 * mirroring `trend_snapshots`) + deterministic opportunity math in core.
 * These schemas are the validated boundary shapes; durable storage is
 * packages/db schema/search.ts.
 */

/**
 * Compilation provenance for a keyword target — first origin wins and is
 * never rewritten (an operator-added keyword the compiler later re-derives
 * stays "operator").
 */
export const SEARCH_TARGET_ORIGINS = [
  /** Deterministic profile-seeded expansion in core (topics × offers × audience × question forms). */
  "profile_seed",
  /** The judged AI expansion pass, grounded to the profile. */
  "ai_expansion",
  /** Hand-added by the operator. */
  "operator",
] as const;
export type SearchTargetOrigin = (typeof SEARCH_TARGET_ORIGINS)[number];

/** Dismissals are operator signal (→ eval rows), so a target is never deleted — it's dismissed. */
export const SEARCH_TARGET_STATUSES = ["active", "dismissed"] as const;
export type SearchTargetStatus = (typeof SEARCH_TARGET_STATUSES)[number];

/** One keyword target as config-as-data — the validated create boundary shape. */
export const searchTargetSchema = z.object({
  /** Canonical query string the tenant targets. */
  keyword: z.string().min(1),
  origin: z.enum(SEARCH_TARGET_ORIGINS),
  /** Compiler provenance (which profile fields seeded it, question form, …) — open shape, data not code. */
  meta: z.record(z.string(), z.unknown()).default({}),
});
export type SearchTargetInput = z.input<typeof searchTargetSchema>;
export type SearchTarget = z.infer<typeof searchTargetSchema>;

/** One video chapter marker (a GEO asset alongside the deterministic SRT). */
export const seoChapterSchema = z.object({
  title: z.string().min(1),
  startMs: z.number().int().min(0),
});
export type SeoChapter = z.infer<typeof seoChapterSchema>;

/**
 * The format-registry SEO-meta capability's field shape (ADR 0006 decision
 * 2): generation-time optimization is format META + a judge lens, never new
 * formats. Formats declaring `capabilities.seoMeta` carry this under an
 * optional `seo` key — optional so every draft persisted before B6.8
 * parses unchanged (additive-only, the B4.2 registry rule). The
 * deterministic on-page checks (meta lengths · question-shaped headings ·
 * JSON-LD · llms.txt) run in core against these fields — zero LLM spend.
 */
export const seoMetaSchema = z.object({
  /** Search queries this artifact deliberately targets (`search_targets` keywords — provenance, one target per page). */
  targetKeywords: z.array(z.string().min(1)).default([]),
  /** SERP/`<title>` title — deterministic length checks in core. */
  metaTitle: z.string().min(1).optional(),
  metaDescription: z.string().min(1).optional(),
  /** JSON-LD types the artifact embeds (e.g. "Organization", "FAQPage", "Product", "VideoObject") — names are data. */
  jsonLdTypes: z.array(z.string().min(1)).default([]),
  /** Video surfaces: platform tags. */
  tags: z.array(z.string().min(1)).default([]),
  /** Video surfaces: chapter markers. */
  chapters: z.array(seoChapterSchema).default([]),
});
export type SeoMeta = z.infer<typeof seoMetaSchema>;
