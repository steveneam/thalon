import type { JudgeEvidence, Verdict } from "@thalon/contracts";
import { z } from "zod";

/**
 * Phase 2c (founder catch, s70c): the SOCIAL DISCOVERABILITY lens — the
 * SEO/AEO/GEO dimension the social path never had. The live LinkedIn post
 * that triggered it was ABOUT AI and said "AI" zero times: grounded, brand
 * safe, and invisible to every answer engine. Pure and deterministic like
 * G1 and the seo-lens (zero model calls): every check is a checkable
 * property of the judged body against the draft's declared TARGET TERMS,
 * each with a reason string.
 *
 * ADVISORY like the seo-lens — the pipeline appends a `discoverability`
 * judge row for operator triage and the queued/blocked outcome never reads
 * it (invariant I1 stays g3_final-only). Opt-in BY DATA: it runs only when
 * a draft's meta carries `targetTerms` (generation starts declaring them
 * with this phase; older drafts judge byte-identically). Golden anchor:
 * eval/golden/discoverability-seed.jsonl — the founder's live edit of the
 * engine's post is the pass row, the engine's original the fail row.
 */

/** The advisory gate label on `judge_results` rows. */
export const DISCOVERABILITY_GATE = "discoverability";

export const discoverabilityConfigSchema = z.object({
  /** Minimum share of target terms the body must carry (the primary term is required regardless). */
  minCoverage: z.number().min(0).max(1).default(0.5),
  /** Platforms where posts carry hashtags — a subject-bearing hashtag is expected there. */
  hashtagPlatforms: z.array(z.string()).default(["linkedin", "x", "instagram", "tiktok"]),
});
export type DiscoverabilityConfigInput = z.input<typeof discoverabilityConfigSchema>;
export type DiscoverabilityConfig = z.infer<typeof discoverabilityConfigSchema>;

export interface DiscoverabilityInput {
  /** The draft's platform (drives the hashtag expectation). */
  platform: string;
  /** Declared at generation: [0] = the subject's canonical entity ("AI" for a post about AI); the rest = supporting terms. */
  targetTerms: string[];
  /** The judged body — the same claim surface G1/G3 read. */
  body: string;
}

export interface DiscoverabilityFinding {
  check: string;
  status: "pass" | "warn" | "skipped";
  reason: string;
}

export interface DiscoverabilityResult {
  /** "fail" = at least one warn — ADVISORY, the pipeline never blocks on it. */
  verdict: Verdict;
  findings: DiscoverabilityFinding[];
  /** Share of target terms the body carries (0..1). */
  coverage: number;
  evidence: JudgeEvidence;
}

/** Lowercase, collapse every non-alphanumeric run to one space — "model-agnostic" ≡ "model agnostic". */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Word-boundary term presence: the normalized term appears as a contiguous token run. */
function bodyCarriesTerm(normalizedBody: string, term: string): boolean {
  const needle = normalizeText(term);
  if (needle === "") return false;
  return ` ${normalizedBody} `.includes(` ${needle} `);
}

/** #Hashtags in the raw body, normalized to their alphanumeric core. */
function hashtagsOf(body: string): string[] {
  return [...body.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase());
}

/** The deterministic check core — importable wherever the checks must agree (defined ONCE). */
export function checkDiscoverability(
  input: DiscoverabilityInput,
  config: DiscoverabilityConfig,
): { findings: DiscoverabilityFinding[]; coverage: number } {
  const findings: DiscoverabilityFinding[] = [];
  const terms = input.targetTerms.filter((t) => t.trim() !== "");
  if (terms.length === 0) {
    return {
      findings: [
        {
          check: "targets_declared",
          status: "warn",
          reason: "no target terms declared — a post that names no subject entities can't be found for them",
        },
      ],
      coverage: 0,
    };
  }

  // Term presence reads PROSE only — hashtags have their own check below,
  // and "#ai" alone must never satisfy "the body talks about AI".
  const normalizedBody = normalizeText(input.body.replace(/#[\p{L}\p{N}_]+/gu, " "));
  const primary = terms[0];
  const hits = terms.filter((term) => bodyCarriesTerm(normalizedBody, term));
  const coverage = hits.length / terms.length;

  const primaryHit = bodyCarriesTerm(normalizedBody, primary);
  findings.push({
    check: "primary_entity_in_body",
    status: primaryHit ? "pass" : "warn",
    reason: primaryHit
      ? `the body carries the subject's canonical entity "${primary}"`
      : `the body NEVER says the subject's canonical entity "${primary}" — no answer engine can surface it for the queries that matter`,
  });

  const missed = terms.filter((term) => !hits.includes(term));
  findings.push({
    check: "term_coverage",
    status: coverage >= config.minCoverage ? "pass" : "warn",
    reason:
      `${hits.length}/${terms.length} target terms present` +
      (missed.length > 0 ? ` — missing: ${missed.map((t) => `"${t}"`).join(", ")}` : ""),
  });

  if (config.hashtagPlatforms.includes(input.platform)) {
    const tags = hashtagsOf(input.body);
    const strippedTerms = terms.map((t) => normalizeText(t).replace(/ /g, "")).filter((t) => t.length >= 2);
    const subjectTag = tags.find((tag) => strippedTerms.some((t) => tag.includes(t)));
    findings.push({
      check: "subject_hashtag",
      status: subjectTag !== undefined ? "pass" : "warn",
      reason:
        subjectTag !== undefined
          ? `a subject-bearing hashtag is present (#${subjectTag})`
          : tags.length > 0
            ? `hashtags present (${tags.map((t) => `#${t}`).join(", ")}) but none carries a target term`
            : "no hashtags on a hashtag platform — the subject tags are free discoverability",
    });
  } else {
    findings.push({
      check: "subject_hashtag",
      status: "skipped",
      reason: `platform "${input.platform}" does not carry hashtags`,
    });
  }

  return { findings, coverage };
}

/** Pure lens entry point: findings → advisory verdict + judge evidence (the seo-lens convention). */
export function runDiscoverabilityLens(
  input: DiscoverabilityInput,
  configInput: DiscoverabilityConfigInput = {},
): DiscoverabilityResult {
  const config = discoverabilityConfigSchema.parse(configInput);
  const { findings, coverage } = checkDiscoverability(input, config);
  const warns = findings.filter((f) => f.status === "warn");
  const skipped = findings.filter((f) => f.status === "skipped");
  return {
    verdict: warns.length === 0 ? "pass" : "fail",
    findings,
    coverage,
    evidence: {
      claims: findings
        .filter((f) => f.status !== "skipped")
        .map((f) => ({
          claim: f.check,
          verdict: f.status === "pass" ? ("pass" as const) : ("fail" as const),
          evidence: f.reason,
        })),
      notes: `advisory discoverability lens (Phase 2c) — never blocks; coverage ${(coverage * 100).toFixed(0)}%, ${warns.length} warning(s), ${skipped.length} skipped`,
    },
  };
}
